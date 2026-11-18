from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Approval

router = APIRouter()


@router.get("/{approval_id}")
async def get_approval(approval_id: UUID, db: AsyncSession = Depends(get_db)):
    approval = await db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return {"approval": approval}
