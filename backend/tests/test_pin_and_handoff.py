"""Approval PIN, handoff uniqueness, repeat alerts, startup checks."""
import logging
import uuid

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from config import Settings, warn_if_prices_unset
from models import Approval, Briefing, EchelonHandoff
from services.echelon_events import apply_event
from conftest import API_KEY, PIN
from test_gap_fill import approve, make_task

KEY = {"X-API-Key": API_KEY}
BAD = {"detail": "approval pin required"}


async def test_task_approve_needs_the_pin(anon, maker):
    r = await anon.post("/tasks/", json={"title": "T", "goal": "G"}, headers=KEY)
    tid = r.json()["task"]["id"]
    for headers in (KEY, {**KEY, "X-Approval-Pin": "wrong-pin"}):
        res = await anon.post(f"/tasks/{tid}/approve", headers=headers)
        assert res.status_code == 403 and res.json() == BAD
    async with maker() as s:  # a refused call creates no approval
        assert (await s.execute(select(func.count()).select_from(Approval))).scalar_one() == 0
    ok = await anon.post(f"/tasks/{tid}/approve", headers={**KEY, "X-Approval-Pin": PIN})
    assert ok.status_code == 200


async def test_approval_approve_needs_the_pin(anon, client):
    task = await make_task(client)
    approval = await approve(client, task["id"])  # the authed client carries the PIN
    for headers in (KEY, {**KEY, "X-Approval-Pin": "wrong-pin"}):
        res = await anon.post(f"/approvals/{approval['id']}/approve", headers=headers)
        assert res.status_code == 403 and res.json() == BAD
    ok = await anon.post(f"/approvals/{approval['id']}/approve", headers={**KEY, "X-Approval-Pin": PIN})
    assert ok.status_code == 200


async def test_resume_needs_the_pin_but_freeze_does_not(anon, echelon):
    assert (await anon.post("/control/freeze", headers=KEY)).status_code == 200
    for headers in (KEY, {**KEY, "X-Approval-Pin": "wrong-pin"}):
        res = await anon.post("/control/resume", headers=headers)
        assert res.status_code == 403 and res.json() == BAD
    assert (await anon.get("/control/status", headers=KEY)).json()["frozen"] is True  # still frozen
    ok = await anon.post("/control/resume", headers={**KEY, "X-Approval-Pin": PIN})
    assert ok.status_code == 200 and ok.json()["frozen"] is False


async def test_pin_unset_fails_closed(client, monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "APPROVAL_PIN", "")
    task = await make_task(client)
    res = await client.post(f"/tasks/{task['id']}/approve")  # the client still sends a PIN header
    assert res.status_code == 403


async def test_create_approval_route_is_gone(client):
    res = await client.post("/approvals/", json={"task_id": str(uuid.uuid4()), "content_hash": "x"})
    assert res.status_code in (404, 405)


async def test_second_handoff_for_same_approval_is_409(client, echelon, maker):
    task = await make_task(client)
    approval = await approve(client, task["id"])
    first = await client.post("/echelon/handoff", params={"task_id": task["id"], "approval_id": approval["id"]})
    assert first.status_code == 200
    # Simulate a second tap that raced past the "used" and "already with ECHELON" checks.
    async with maker() as s:
        (await s.get(Approval, uuid.UUID(approval["id"]))).used = False
        row = (await s.execute(select(EchelonHandoff))).scalars().first()
        row.status = "failed"
        await s.commit()
    second = await client.post("/echelon/handoff", params={"task_id": task["id"], "approval_id": approval["id"]})
    assert second.status_code == 409
    async with maker() as s:
        assert (await s.execute(select(func.count()).select_from(EchelonHandoff))).scalar_one() == 1


async def test_a_task_that_blocks_twice_alerts_twice(client, echelon, maker):
    task = await make_task(client)
    approval = await approve(client, task["id"])
    await client.post("/echelon/handoff", params={"task_id": task["id"], "approval_id": approval["id"]})

    async def event(status, eid):
        async with maker() as s:
            await apply_event(s, {"task_id": "e-1", "status": status}, eid)

    await event("blocked", "1")
    await event("in_progress", "2")
    await event("blocked", "3")
    await event("blocked", "3")  # the feed replays an event after a reconnect: no third alert
    async with maker() as s:
        alerts = (await s.execute(select(func.count()).select_from(Briefing).where(Briefing.kind == "alert"))).scalar_one()
    assert alerts == 2


def _settings(**over):
    base = dict(DATABASE_URL="sqlite+aiosqlite://", API_KEY="k" * 20, OMNIROUTE_API_KEY="o-key", ECHELON_API_KEY="", APPROVAL_PIN="")
    base.update(over)
    return Settings(_env_file=None, **base)


@pytest.mark.parametrize("pin", ["", "12345"])
def test_startup_refused_without_a_good_pin_when_echelon_is_on(pin):
    with pytest.raises(ValidationError):
        _settings(ECHELON_API_KEY="real-echelon-key", APPROVAL_PIN=pin)


def test_standalone_may_start_without_a_pin_and_a_good_pin_passes():
    assert _settings().APPROVAL_PIN == ""
    assert _settings(ECHELON_API_KEY="real-echelon-key", APPROVAL_PIN="246810").echelon_enabled


def test_price_warning_fires_only_for_a_non_default_model_with_unset_prices(caplog):
    with caplog.at_level(logging.WARNING, logger="marcus.config"):
        warn_if_prices_unset(_settings())
        assert not caplog.records
        warn_if_prices_unset(_settings(OMNIROUTE_MODEL="big-model"))
        assert len(caplog.records) == 1 and "OMNIROUTE_PRICE_IN_PER_1M" in caplog.records[0].getMessage()
        caplog.clear()
        priced = dict(OMNIROUTE_PRICE_IN_PER_1M=1.0, OMNIROUTE_PRICE_OUT_PER_1M=2.0, OMNIROUTE_EMBED_PRICE_PER_1M=0.1)
        warn_if_prices_unset(_settings(OMNIROUTE_MODEL="big-model", **priced))
        assert not caplog.records
