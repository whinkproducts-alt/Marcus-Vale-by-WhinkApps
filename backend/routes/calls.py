import logging

from fastapi import APIRouter, Depends, HTTPException

from schemas import CallCreate
from services import calls
from services.auth import require_approval_pin

router = APIRouter()
log = logging.getLogger("marcus.calls")


@router.get("/config")
async def call_config():
    return {"configured": calls.configured(), "default_destination": bool(calls.configured())}


@router.post("", dependencies=[Depends(require_approval_pin)])
async def create_call(body: CallCreate):
    try:
        return await calls.place_call(body.message, body.to)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except calls.CallError as exc:
        log.warning("outbound call failed: %s", str(exc)[:80])
        raise HTTPException(status_code=502 if calls.configured() else 503, detail="Phone calls are unavailable")


@router.get("/{call_id}")
async def call_status(call_id: str):
    try:
        return await calls.get_call(call_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except calls.CallError as exc:
        log.warning("call status failed: %s", str(exc)[:80])
        raise HTTPException(status_code=502 if calls.configured() else 503, detail="Phone call status is unavailable")
