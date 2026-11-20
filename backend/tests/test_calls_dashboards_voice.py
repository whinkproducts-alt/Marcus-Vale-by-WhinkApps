import base64
from unittest.mock import AsyncMock

import pytest

from conftest import API_KEY, PIN
from routes import calls as call_routes
from routes import voice as voice_routes
from routes import echelon as echelon_routes


@pytest.mark.asyncio
async def test_call_requires_pin_and_returns_provider_status(anon, monkeypatch):
    monkeypatch.setattr(call_routes.calls, "configured", lambda: True)
    placed = AsyncMock(return_value={"call_id": "CA" + "a" * 32, "status": "queued"})
    monkeypatch.setattr(call_routes.calls, "place_call", placed)
    body = {"message": "Victor, this is Marcus."}
    denied = await anon.post("/calls", json=body, headers={"X-API-Key": API_KEY})
    assert denied.status_code == 403
    ok = await anon.post(
        "/calls", json=body, headers={"X-API-Key": API_KEY, "X-Approval-Pin": PIN}
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "queued"
    placed.assert_awaited_once_with(body["message"], None)


@pytest.mark.asyncio
async def test_voice_choice_persists_and_drives_synthesis(client, monkeypatch):
    updated = await client.put("/settings/voice", json={"voice": "am_adam"})
    assert updated.status_code == 200
    synth = AsyncMock(return_value=b"audio")
    monkeypatch.setattr(voice_routes, "synthesize", synth)
    response = await client.post("/voice/synthesize", json={"text": "Hello"})
    assert response.status_code == 200
    assert base64.b64decode(response.json()["audio"]) == b"audio"
    synth.assert_awaited_once_with("Hello", "en", "am_adam")


@pytest.mark.asyncio
async def test_echelon_dashboard_catalog_and_detail_are_read_only(client, monkeypatch):
    monkeypatch.setattr(echelon_routes.ec, "enabled", lambda: True)
    monkeypatch.setattr(
        echelon_routes.ec,
        "list_dashboards",
        AsyncMock(return_value={"dashboards": [{"id": "overview", "path": "/dashboard"}]}),
    )
    monkeypatch.setattr(
        echelon_routes.ec,
        "get_dashboard",
        AsyncMock(return_value={"id": "overview", "projects": 3}),
    )
    catalog = await client.get("/echelon/dashboards")
    assert catalog.status_code == 200
    assert catalog.json()["dashboards"][0]["href"].endswith("/dashboard")
    detail = await client.get("/echelon/dashboards/overview")
    assert detail.status_code == 200
    assert detail.json() == {"id": "overview", "projects": 3}
