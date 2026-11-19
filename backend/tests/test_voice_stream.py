"""POST /voice/chat/stream against a fake OmniRoute that streams server-sent events."""
import json
import types
from unittest.mock import patch

import httpx
import pytest
from sqlalchemy import select

import database
from models import ChatMessage, SpendLog
from services import spend
from tests.conftest import REAL_CLIENT


def sse_body(deltas, usage=None):
    lines = [f"data: {json.dumps({'choices': [{'delta': {'content': d}}]})}\n\n" for d in deltas]
    if usage:
        lines.append(f"data: {json.dumps({'choices': [], 'usage': usage})}\n\n")
    lines.append("data: [DONE]\n\n")
    return "".join(lines).encode()


@pytest.fixture
def stream_llm():
    state = types.SimpleNamespace(requests=[], deltas=["Good morning, ", "Victor. ", "All clear."], usage=None, status=200)

    def route(request):
        state.requests.append(json.loads(request.content))
        if state.status != 200:
            return httpx.Response(state.status)
        return httpx.Response(200, content=sse_body(state.deltas, state.usage), headers={"content-type": "text/event-stream"})

    ns = types.SimpleNamespace(AsyncClient=lambda **kw: REAL_CLIENT(transport=httpx.MockTransport(route), **kw))
    with patch("services.omniroute.httpx", ns):
        yield state


def parse(text):
    out = []
    for block in text.strip().split("\n\n"):
        ev, data = block.split("\n")
        out.append((ev[7:], json.loads(data[6:])))
    return out


async def test_events_in_order_and_streamed_flag(client, stream_llm):
    r = await client.post("/voice/chat/stream", json={"prompt": "hi", "session_id": "s"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert parse(r.text) == [("sentence", {"text": "Good morning, Victor."}), ("sentence", {"text": "All clear."}), ("done", {})]
    assert stream_llm.requests[0]["stream"] is True


async def test_voice_model_used_when_set(client, stream_llm):
    with patch("config.settings.OMNIROUTE_VOICE_MODEL", "fast-one"):
        await client.post("/voice/chat/stream", json={"prompt": "hi"})
    assert stream_llm.requests[0]["model"] == "fast-one"
    await client.post("/voice/chat/stream", json={"prompt": "hi"})
    from config import settings
    assert stream_llm.requests[1]["model"] == settings.OMNIROUTE_MODEL


async def test_turn_saved_and_cost_recorded(client, stream_llm, maker):
    stream_llm.usage = {"prompt_tokens": 100, "completion_tokens": 20}
    await client.post("/voice/chat/stream", json={"prompt": "hello", "session_id": "keep"})
    async with maker() as s:
        rows = (await s.execute(select(ChatMessage).where(ChatMessage.session_id == "keep").order_by(ChatMessage.role.desc()))).scalars().all()
        assert [r.role for r in rows] == ["user", "assistant"]
        assert rows[1].content == "Good morning, Victor. All clear."
        assert len((await s.execute(select(SpendLog))).scalars().all()) == 1


async def test_402_when_capped_before_any_bytes(client, stream_llm):
    with patch.object(spend, "ensure_budget", side_effect=spend.SpendCapReached("cap")):
        r = await client.post("/voice/chat/stream", json={"prompt": "hi"})
    assert r.status_code == 402
    assert stream_llm.requests == []


async def test_model_down_is_generic_502(client, stream_llm):
    stream_llm.status = 500
    r = await client.post("/voice/chat/stream", json={"prompt": "hi"})
    assert r.status_code == 502
    assert "500" not in r.text and "http" not in r.text.lower()


async def test_freeze_phrase_freezes_without_model(client, stream_llm):
    r = await client.post("/voice/chat/stream", json={"prompt": "Marcus, stop everything"})
    assert [e for e, _ in parse(r.text)] == ["sentence", "done"]
    assert stream_llm.requests == []
    assert (await client.get("/control/status")).json()["frozen"] is True


async def test_resume_phrase_does_not_unfreeze(client, stream_llm):
    await client.post("/control/freeze")
    r = await client.post("/voice/chat/stream", json={"prompt": "Marcus, resume"})
    assert "PIN" in parse(r.text)[0][1]["text"]
    assert stream_llm.requests == []
    assert (await client.get("/control/status")).json()["frozen"] is True


async def test_never_store_turn_not_persisted(client, stream_llm, maker):
    stream_llm.deltas = ["Noted, I will not keep that."]
    r = await client.post("/voice/chat/stream", json={"prompt": "my password is hunter2hunter2", "session_id": "ns"})
    assert r.status_code == 200 and "hunter2" not in r.text
    async with maker() as s:
        assert (await s.execute(select(ChatMessage).where(ChatMessage.session_id == "ns"))).scalars().all() == []


async def test_requires_api_key(anon, stream_llm):
    assert (await anon.post("/voice/chat/stream", json={"prompt": "hi"})).status_code in (401, 403)


async def test_aborted_stream_not_persisted(client, stream_llm, maker):
    from routes import voice

    async def aborted(*a, **k):
        yield "First sentence. "
        raise GeneratorExit  # client went away mid-reply

    with patch.object(voice, "generate_stream", aborted):
        try:
            r = await client.post("/voice/chat/stream", json={"prompt": "hi", "session_id": "ab"})
        except BaseException:
            pass
    async with maker() as s:
        assert (await s.execute(select(ChatMessage).where(ChatMessage.session_id == "ab"))).scalars().all() == []
