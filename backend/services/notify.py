"""Outbound-only pings. The text is fixed and generic on purpose: sending task or briefing content outside the
account is a protected action, a generic ping is not. No tools, no replies. Every channel is off until its
credentials are set AND it is enabled in settings."""
import asyncio
import json
import logging
import smtplib
from email.message import EmailMessage

import httpx

import database
from config import settings
from services.settings_store import get_setting

log = logging.getLogger("marcus.notify")
KEY = "alert_channels"
CHANNELS = ("telegram", "whatsapp", "email")
TEXT = {"briefing": "New briefing from Marcus", "alert": "Marcus needs you"}
TIMEOUT = 10.0
_sent: set[str] = set()  # shortcut: in memory, a restart may repeat one ping; fine for a generic ping


def configured(channel: str) -> bool:
    s = settings
    need = {
        "telegram": (s.TELEGRAM_BOT_TOKEN, s.TELEGRAM_CHAT_ID),
        "whatsapp": (s.TWILIO_ACCOUNT_SID, s.TWILIO_AUTH_TOKEN, s.TWILIO_WHATSAPP_FROM, s.ALERT_WHATSAPP_TO),
        "email": (s.SMTP_HOST, s.SMTP_FROM, s.ALERT_EMAIL_TO),
    }[channel]
    return all(need)


async def enabled_channels(db) -> list[str]:
    try:
        raw = json.loads(await get_setting(db, KEY, "[]"))
    except ValueError:
        return []
    return [c for c in CHANNELS if c in raw] if isinstance(raw, list) else []


async def _telegram(text: str) -> None:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text},
        )
        r.raise_for_status()


async def _whatsapp(text: str) -> None:
    s = settings
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{s.TWILIO_ACCOUNT_SID}/Messages.json",
            auth=(s.TWILIO_ACCOUNT_SID, s.TWILIO_AUTH_TOKEN),
            data={"From": f"whatsapp:{s.TWILIO_WHATSAPP_FROM}", "To": f"whatsapp:{s.ALERT_WHATSAPP_TO}", "Body": text},
        )
        r.raise_for_status()


def _smtp_send(text: str) -> None:
    s = settings
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.SMTP_FROM, s.ALERT_EMAIL_TO, text
    msg.set_content(text)
    with smtplib.SMTP(s.SMTP_HOST, s.SMTP_PORT, timeout=TIMEOUT) as smtp:
        smtp.starttls()
        if s.SMTP_USER:
            smtp.login(s.SMTP_USER, s.SMTP_PASS)
        smtp.send_message(msg)


async def _email(text: str) -> None:
    await asyncio.to_thread(_smtp_send, text)


async def ping(kind: str, ref: str | None = None) -> None:
    """Send the fixed text for kind (briefing|alert) to every configured and enabled channel. Never raises."""
    try:
        text = TEXT[kind]
        if ref is not None:
            if ref in _sent:
                return
            _sent.add(ref)
        async with database.AsyncSessionLocal() as db:
            chosen = await enabled_channels(db)
        senders = {"telegram": _telegram, "whatsapp": _whatsapp, "email": _email}
        for ch in chosen:
            if not configured(ch):
                continue
            try:
                await senders[ch](text)
            except Exception as e:  # log the class only: the message can carry a token or number
                log.warning("alert ping failed: channel=%s error=%s", ch, type(e).__name__)
    except Exception as e:
        log.warning("alert ping failed: error=%s", type(e).__name__)


def ping_later(kind: str, ref: str | None = None) -> None:
    """Fire and forget."""
    try:
        t = asyncio.get_running_loop().create_task(ping(kind, ref))
        _bg.add(t)
        t.add_done_callback(_bg.discard)
    except RuntimeError:
        pass


_bg: set = set()  # keeps tasks alive until done
