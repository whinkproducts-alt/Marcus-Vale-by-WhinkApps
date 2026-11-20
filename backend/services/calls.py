"""PIN-gated outbound phone calls through Twilio. No call audio or phone numbers are logged."""
import re
from html import escape

import httpx

from config import settings

TIMEOUT = 20.0
_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class CallError(Exception):
    pass


def configured() -> bool:
    s = settings
    return all((s.TWILIO_ACCOUNT_SID, s.TWILIO_AUTH_TOKEN, s.TWILIO_VOICE_FROM, s.OWNER_PHONE_NUMBER))


def _number(value: str) -> str:
    value = value.strip()
    if not _E164.fullmatch(value):
        raise ValueError("Phone number must use E.164 format, for example +14035550123")
    return value


async def place_call(message: str, to: str | None = None) -> dict:
    if not configured():
        raise CallError("Phone calls are not configured")
    destination = _number(to or settings.OWNER_PHONE_NUMBER)
    source = _number(settings.TWILIO_VOICE_FROM)
    twiml = f'<Response><Say voice="Polly.Matthew">{escape(message)}</Say></Response>'
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Calls.json",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                data={"From": source, "To": destination, "Twiml": twiml},
            )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise CallError(type(exc).__name__) from exc
    return {"call_id": str(data.get("sid", "")), "status": str(data.get("status", "queued"))}


async def get_call(call_id: str) -> dict:
    if not configured():
        raise CallError("Phone calls are not configured")
    if not re.fullmatch(r"CA[a-fA-F0-9]{32}", call_id):
        raise ValueError("Invalid call id")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Calls/{call_id}.json",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise CallError(type(exc).__name__) from exc
    return {"call_id": call_id, "status": str(data.get("status", "unknown"))}
