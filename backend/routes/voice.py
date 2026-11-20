import base64
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ChatMessage, Memory
from schemas import ChatRequest, SynthesizeRequest, VoiceRequest
from services.control_state import FROZEN_MESSAGE, get_frozen
from services.freeze import do_freeze, kill_message
from services.kokoro import content_type, synthesize
from services.settings_store import get_setting
from services.never_store import check
from services.omniroute import generate, generate_stream
from services.sentences import split_sentences_async
from services.scheduler import change_timezone, resolve_timezone
from services.spend import SpendCapReached
from services.whisper import transcribe

log = logging.getLogger("marcus.voice")
router = APIRouter()

KILL_PHRASE = "marcus stop everything"
RESUME_PHRASE = "marcus resume"
RESUME_NEEDS_PIN = "Resume needs your PIN. Open the app, enter your PIN and tap Resume."
_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
HISTORY_LIMIT = 20
CORE_FACT_LIMIT = 25
_TZ_RE = re.compile(r"time ?zone to (.+)$", re.IGNORECASE)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


@router.post("/transcribe")
async def transcribe_voice(request: VoiceRequest):
    try:
        return {"text": await transcribe(request.audio, request.language)}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        log.warning("transcribe failed: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Speech to text is unavailable")


@router.post("/synthesize")
async def synthesize_voice(body: SynthesizeRequest, db: AsyncSession = Depends(get_db)):
    try:
        voice = await get_setting(db, "voice_choice", None)
        audio = await synthesize(body.text, body.language, voice)
        return {"audio": base64.b64encode(audio).decode("utf-8"), "content_type": content_type()}
    except Exception as e:
        log.warning("synthesize failed: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Text to speech is unavailable")


async def _remember_turn(db: AsyncSession, session_id: str, prompt: str, reply: str) -> None:
    """Persist a turn only if neither side holds never-store content."""
    if check(prompt) or check(reply):
        return
    db.add(ChatMessage(session_id=session_id, role="user", content=prompt))
    db.add(ChatMessage(session_id=session_id, role="assistant", content=reply))
    await db.commit()


async def _shortcut(db: AsyncSession, prompt: str) -> str | None:
    """Fixed replies that never reach the model: kill phrase, resume phrase, time zone."""
    norm = _norm(prompt)
    # Freezing fails safe, so the phrase works frozen or not. Resuming needs the PIN, which chat text cannot carry:
    # any pasted text or background audio containing the phrase would otherwise unfreeze Marcus and ECHELON.
    if KILL_PHRASE in norm:
        return kill_message(await do_freeze(db))
    if RESUME_PHRASE in norm:
        return RESUME_NEEDS_PIN

    # Time zone by voice.
    m = _TZ_RE.search(prompt.strip().rstrip(".!?"))
    if m:
        tz_name = resolve_timezone(m.group(1))
        if tz_name is None:
            return "I could not match that time zone. Say a city or a name like America/Edmonton."
        await change_timezone(db, tz_name)
        return f"Time zone set to {tz_name}. My schedule now follows it."
    return None


async def _context(db: AsyncSession, session_id: str) -> tuple[list[dict], list[str]]:
    # Conversation keeps working while frozen. Only tasks and handoffs are blocked.
    history_rows = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
    ).scalars().all()
    history = [{"role": r.role, "content": r.content} for r in reversed(history_rows)]
    facts = (
        await db.execute(select(Memory.content).where(Memory.layer == "layer2").limit(CORE_FACT_LIMIT))
    ).scalars().all()
    return history, list(facts)


@router.post("/chat")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    fixed = await _shortcut(db, request.prompt)
    if fixed is not None:
        return {"response": fixed}
    history, facts = await _context(db, request.session_id)

    try:
        reply = await generate(request.prompt, history=history, core_facts=facts)
    except SpendCapReached:
        raise HTTPException(status_code=402, detail="Monthly spend cap reached. Chat is paused until next month.")
    except Exception as e:
        log.warning("chat failed: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Marcus could not reach the language model")

    await _remember_turn(db, request.session_id, request.prompt, reply)
    return {"response": reply}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Same rules as /chat, but the reply arrives as whole sentences (server-sent events)."""
    fixed = await _shortcut(db, request.prompt)
    if fixed is not None:
        async def one():
            yield _sse("sentence", {"text": fixed})
            yield _sse("done", {})
        return StreamingResponse(one(), media_type="text/event-stream", headers=_SSE_HEADERS)

    history, facts = await _context(db, request.session_id)
    sentences = split_sentences_async(generate_stream(request.prompt, history=history, core_facts=facts))
    # Pull the first sentence now so a spend cap (402) or a dead model (502) is a real status code, before any bytes go out.
    try:
        first = await sentences.__anext__()
    except StopAsyncIteration:
        first = None
    except SpendCapReached:
        raise HTTPException(status_code=402, detail="Monthly spend cap reached. Chat is paused until next month.")
    except Exception as e:
        log.warning("chat stream failed: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Marcus could not reach the language model")

    async def events():
        spoken: list[str] = []
        clean = False
        try:
            if first is not None:
                spoken.append(first)
                yield _sse("sentence", {"text": first})
                async for s in sentences:
                    spoken.append(s)
                    yield _sse("sentence", {"text": s})
            clean = True
        except Exception as e:
            log.warning("chat stream failed mid-reply: %s", type(e).__name__)
            yield _sse("error", {"detail": "Marcus could not finish the reply"})
            return
        finally:
            await sentences.aclose()
            # Runs on client abort too: only a reply that finished cleanly is saved.
            if clean and spoken:
                await _remember_turn(db, request.session_id, request.prompt, " ".join(spoken))
        yield _sse("done", {})

    return StreamingResponse(events(), media_type="text/event-stream", headers=_SSE_HEADERS)
