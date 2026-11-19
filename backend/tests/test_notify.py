import json
import logging
import smtplib
from unittest.mock import patch

import httpx
import pytest

from config import settings
from models import Task
from services import notify
from services.settings_store import set_setting

SECRETS = dict(
    TELEGRAM_BOT_TOKEN="tg-token-SECRET", TELEGRAM_CHAT_ID="555777",
    TWILIO_ACCOUNT_SID="ACsid-SECRET", TWILIO_AUTH_TOKEN="twilio-SECRET",
    TWILIO_WHATSAPP_FROM="+10000000001", ALERT_WHATSAPP_TO="+10000000002",
    SMTP_HOST="smtp.test", SMTP_FROM="m@mail.test", ALERT_EMAIL_TO="v@mail.test", SMTP_USER="smtp-user-SECRET", SMTP_PASS="smtp-SECRET",
)


@pytest.fixture
def env(monkeypatch):
    for k, v in SECRETS.items():
        monkeypatch.setattr(settings, k, v)
    notify._sent.clear()


class Net:
    def __init__(self):
        self.calls, self.fail = [], set()

    async def post(self, url, **kw):
        ch = "telegram" if "telegram" in url else "whatsapp"
        self.calls.append((ch, url, kw))
        if ch in self.fail:
            raise httpx.ConnectError("boom " + SECRETS["TELEGRAM_BOT_TOKEN"])
        return httpx.Response(200, request=httpx.Request("POST", url))

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        pass


@pytest.fixture
def net():
    n = Net()
    mails = []

    class SMTP:
        def __init__(self, *a, **k):
            if "email" in n.fail:
                raise OSError("smtp down")

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def starttls(self): pass
        def login(self, *a): pass
        def send_message(self, m): mails.append(m)

    n.mails = mails
    with patch.object(notify.httpx, "AsyncClient", lambda **k: n), patch.object(smtplib, "SMTP", SMTP):
        yield n


async def enable(maker, *chs):
    async with maker() as db:
        await set_setting(db, notify.KEY, json.dumps(list(chs)))


async def test_fixed_text_only_no_title_leak(env, net, maker):
    async with maker() as db:
        db.add(Task(title="SECRET-TITLE", goal="SECRET-GOAL"))
        await db.commit()
    await enable(maker, "telegram", "whatsapp", "email")
    await notify.ping("alert", "a1")
    await notify.ping("briefing", "b1")
    blob = repr(net.calls) + repr([m.as_string() for m in net.mails])
    assert "SECRET-TITLE" not in blob and "SECRET-GOAL" not in blob
    assert "Marcus needs you" in blob and "New briefing from Marcus" in blob
    assert len(net.calls) == 4 and len(net.mails) == 2
    assert net.calls[0][2]["json"]["text"] == "Marcus needs you"


async def test_off_when_not_enabled_or_not_configured(env, net, maker, monkeypatch):
    await notify.ping("alert", "x")  # nothing enabled
    assert not net.calls and not net.mails
    await enable(maker, "telegram", "email")
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    await notify.ping("alert", "y")
    assert not net.calls and not net.mails


async def test_failing_channel_does_not_stop_others_or_leak(env, net, maker, caplog):
    await enable(maker, "telegram", "whatsapp", "email")
    net.fail = {"telegram", "email"}
    with caplog.at_level(logging.DEBUG):
        await notify.ping("alert", "z")
    assert [c[0] for c in net.calls] == ["telegram", "whatsapp"]
    log = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("marcus"))
    assert "ConnectError" in log and "OSError" in log
    for secret in list(SECRETS.values()):
        assert secret not in log


async def test_dedupe(env, net, maker):
    await enable(maker, "telegram")
    await notify.ping("alert", "same")
    await notify.ping("alert", "same")
    assert len(net.calls) == 1


async def test_put_needs_pin_and_validates(anon, client, env, maker):
    r = await anon.put("/settings/alert-channels", json={"channels": ["telegram"]}, headers={"X-API-Key": "test-api-key-0123456789"})
    assert r.status_code == 403
    r = await client.put("/settings/alert-channels", json={"channels": ["sms"]})
    assert r.status_code == 400
    r = await client.put("/settings/alert-channels", json={"channels": ["telegram", "email"]})
    assert r.status_code == 200 and r.json()["telegram"] == {"configured": True, "enabled": True}
    assert "SECRET" not in r.text
    assert (await client.get("/settings/alert-channels")).json()["whatsapp"]["enabled"] is False


async def test_enable_unconfigured_is_400(client, monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "")
    r = await client.put("/settings/alert-channels", json={"channels": ["telegram"]})
    assert r.status_code == 400
