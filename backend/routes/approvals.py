from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Approval
from services.auth import require_approval_pin

router = APIRouter()


@router.get("/{approval_id}")
async def get_approval(approval_id: UUID, db: AsyncSession = Depends(get_db)):
    approval = await db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return {"approval": approval}


@router.post("/{approval_id}/approve", dependencies=[Depends(require_approval_pin)])
async def approve(approval_id: UUID, db: AsyncSession = Depends(get_db)):
    approval = await db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.used:
        raise HTTPException(status_code=409, detail="Approval already used")
    approval.status = "approved"
    approval.approved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(approval)
    return {"approval": approval}
