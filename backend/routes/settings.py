import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import TimezoneUpdate
from services.auth import require_approval_pin
from services.notify import CHANNELS, KEY, configured, enabled_channels
from services.settings_store import set_setting
from services.scheduler import change_timezone, current_timezone

router = APIRouter()


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
