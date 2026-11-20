import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import TimezoneUpdate, VoicePreference
from services.auth import require_approval_pin
from services.notify import CHANNELS, KEY, configured, enabled_channels
from services.settings_store import get_setting, set_setting
from services.scheduler import change_timezone, current_timezone

router = APIRouter()
VOICE_CHOICES = {
    "am_michael": "Michael · warm American",
    "am_adam": "Adam · grounded American",
    "af_bella": "Bella · clear American",
    "af_sarah": "Sarah · calm American",
}


@router.get("/timezone")
async def get_timezone(db: AsyncSession = Depends(get_db)):
    return {"timezone": await current_timezone(db)}


@router.put("/timezone")
async def put_timezone(body: TimezoneUpdate, db: AsyncSession = Depends(get_db)):
    try:
        await change_timezone(db, body.timezone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Unknown time zone")
    return {"timezone": body.timezone}


class AlertChannels(BaseModel):
    channels: List[str]


async def _channel_state(db):
    on = await enabled_channels(db)
    return {c: {"configured": configured(c), "enabled": c in on} for c in CHANNELS}


@router.get("/alert-channels")
async def get_alert_channels(db: AsyncSession = Depends(get_db)):
    return await _channel_state(db)


@router.put("/alert-channels", dependencies=[Depends(require_approval_pin)])
async def put_alert_channels(body: AlertChannels, db: AsyncSession = Depends(get_db)):
    wanted = sorted(set(body.channels))
    if any(c not in CHANNELS for c in wanted):
        raise HTTPException(status_code=400, detail="Unknown channel")
    if any(not configured(c) for c in wanted):
        raise HTTPException(status_code=400, detail="Channel not configured")
    await set_setting(db, KEY, json.dumps(wanted))
    return await _channel_state(db)


@router.get("/voice")
async def get_voice(db: AsyncSession = Depends(get_db)):
    selected = await get_setting(db, "voice_choice", "am_michael")
    if selected not in VOICE_CHOICES:
        selected = "am_michael"
    return {"voice": selected, "choices": [{"id": key, "label": label} for key, label in VOICE_CHOICES.items()]}


@router.put("/voice")
async def put_voice(body: VoicePreference, db: AsyncSession = Depends(get_db)):
    if body.voice not in VOICE_CHOICES:
        raise HTTPException(status_code=422, detail="Unknown voice")
    await set_setting(db, "voice_choice", body.voice)
    return {"voice": body.voice, "choices": [{"id": key, "label": label} for key, label in VOICE_CHOICES.items()]}
