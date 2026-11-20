import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from config import settings
from models import Approval, EchelonHandoff, Task
from schemas import EchelonApproval, EchelonHandoffCreate, ResumeRequest
from services import echelon_client as ec
from services.auth import require_approval_pin
from services.control_state import FROZEN_MESSAGE, get_frozen
from services.hashing import as_utc, task_deadline_str, task_hash
from services.task_status import DEAD_HANDOFF, task_status_for

log = logging.getLogger("marcus.echelon")
router = APIRouter()
# Timeouts after the request left: the task may have arrived. Connect and pool timeouts mean it did not.
SENT_MAYBE = ("ReadTimeout", "WriteTimeout")


def _check_approval(task: Task, approval: Approval) -> None:
    if approval.task_id != task.id:
        raise HTTPException(status_code=400, detail="Approval does not belong to this task")
    if approval.used:
        raise HTTPException(status_code=400, detail="Approval already used")
    if approval.status != "approved":
        raise HTTPException(status_code=400, detail="Approval not granted")
    if approval.approved_at is None:
        raise HTTPException(status_code=400, detail="Approval has no approval time")
    if task_hash(task) != approval.content_hash:
        raise HTTPException(status_code=400, detail="Task content has changed since approval")


def _approval_payload(approval: Approval) -> dict:
    try:
        model = EchelonApproval(
            approval_id=approval.id,
            approved_at=as_utc(approval.approved_at),
            method=approval.method,
            content_hash=approval.content_hash,
        )
    except ValidationError:
        raise HTTPException(status_code=400, detail="Approval method must be voice or tap")
    return model.model_dump(mode="json")


async def _load(db: AsyncSession, task_id: UUID, approval_id: UUID) -> tuple[Task, Approval]:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    approval = await db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return task, approval


async def _latest_handoff(db: AsyncSession, task_id: UUID) -> EchelonHandoff | None:
    result = await db.execute(
        select(EchelonHandoff).where(EchelonHandoff.task_id == task_id).order_by(EchelonHandoff.created_at.desc())
    )
    return result.scalars().first()


async def _claim(db: AsyncSession, approval: Approval) -> None:
    """Spend the approval atomically BEFORE ECHELON is called, so two simultaneous taps cannot both send."""
    res = await db.execute(
        update(Approval).where(Approval.id == approval.id, Approval.used == False).values(used=True)  # noqa: E712
    )
    if res.rowcount != 1:
        raise HTTPException(status_code=409, detail="Approval already used")
    await db.commit()


async def _release(db: AsyncSession, approval: Approval) -> None:
    """ECHELON did not take the task, so the approval is good again."""
    await db.execute(update(Approval).where(Approval.id == approval.id).values(used=False))
    await db.commit()


def _need_echelon() -> None:
    if not ec.enabled():
        raise HTTPException(status_code=503, detail="ECHELON is not connected")


def _refused(e: ec.EchelonError) -> HTTPException:
    return HTTPException(status_code=502, detail=e.public_message())


@router.post("/handoff")
async def create_handoff(task_id: UUID, approval_id: UUID, db: AsyncSession = Depends(get_db)):
    _need_echelon()
    if await get_frozen(db):
        raise HTTPException(status_code=503, detail=FROZEN_MESSAGE)
    task, approval = await _load(db, task_id, approval_id)
    _check_approval(task, approval)

    existing = await _latest_handoff(db, task_id)
    if existing is not None and existing.status not in DEAD_HANDOFF:
        raise HTTPException(status_code=409, detail="Task is already with ECHELON")

    handoff = EchelonHandoffCreate(
        client_operation_id=task.client_operation_id or task.id,
        title=task.title,
        goal=task.goal,
        deadline=task_deadline_str(task),
        approval=_approval_payload(approval),
        sensitivity=task.sensitivity,
        directorate=task.directorate,
        subsidiary=task.subsidiary,
        target_subsidiaries=task.target_subsidiaries or [],
    )
    payload = ec.seal_payload(handoff.model_dump(mode="json"))

    await _claim(db, approval)
    try:
        response = await ec.send_task(payload)
    except Exception as e:
        if isinstance(e, ec.EchelonError) and e.status is None and e.code in SENT_MAYBE:
            # ECHELON may have the task already; releasing would invite a second send. Victor checks first.
            log.warning("handoff timed out: %s", e.code)
            raise HTTPException(
                status_code=502,
                detail="ECHELON did not answer in time and may have received the task. Check the task status before approving again.",
            )
        await _release(db, approval)
        if isinstance(e, ec.EchelonError):
            log.warning("handoff failed: %s", e.public_message())
            raise _refused(e)
        raise

    status = response.get("status") or "received"
    db.add(
        EchelonHandoff(
            task_id=task.id,
            approval_id=approval.id,
            echelon_task_id=str(response["task_id"]),
            status=status,
            response=response,
        )
    )
    task.status = task_status_for(status)
    try:
        await db.commit()
    except IntegrityError:
        # The unique index on approval_id caught a second tap that raced past the checks above.
        await db.rollback()
        raise HTTPException(status_code=409, detail="Task is already with ECHELON")
    return {"echelon_response": response, "status": status, "task_status": task.status}


@router.post("/confirm")
async def confirm_handoff(task_id: UUID, approval_id: UUID, db: AsyncSession = Depends(get_db)):
    """Second yes for money or proprietary work held by ECHELON."""
    _need_echelon()
    if await get_frozen(db):
        raise HTTPException(status_code=503, detail=FROZEN_MESSAGE)
    task, approval = await _load(db, task_id, approval_id)
    handoff = await _latest_handoff(db, task_id)
    if handoff is None or handoff.status != "reconfirmation_required":
        raise HTTPException(status_code=409, detail="Task is not waiting for a second approval")
    if handoff.approval_id == approval.id:
        raise HTTPException(status_code=400, detail="The second approval must be a new one")
    _check_approval(task, approval)

    await _claim(db, approval)
    try:
        response = await ec.confirm_task(handoff.echelon_task_id, _approval_payload(approval))
    except Exception as e:
        await _release(db, approval)
        if isinstance(e, ec.EchelonError):
            log.warning("confirm failed: %s", e.public_message())
            raise _refused(e)
        raise

    status = response.get("status") or "received"
    handoff.status = status
    handoff.response = response
    task.status = task_status_for(status)
    await db.commit()
    return {"echelon_response": response, "status": status, "task_status": task.status}


@router.post("/resume", dependencies=[Depends(require_approval_pin)])
async def resume_blocked(task_id: UUID, body: ResumeRequest, db: AsyncSession = Depends(get_db)):
    """Send Victor's answer to a blocked ECHELON task. The note speaks for Victor, so it needs the PIN."""
    _need_echelon()
    if await get_frozen(db):
        raise HTTPException(status_code=503, detail=FROZEN_MESSAGE)
    task = await db.get(Task, task_id)
    handoff = await _latest_handoff(db, task_id)
    if task is None or handoff is None:
        raise HTTPException(status_code=404, detail="Handoff not found")
    if handoff.status not in ("blocked", "paused"):
        raise HTTPException(status_code=409, detail="Task is not waiting for an answer")
    try:
        response = await ec.resume_task(handoff.echelon_task_id, body.note)
    except ec.EchelonError as e:
        raise _refused(e)
    handoff.status = response.get("status") or "in_progress"
    task.status = task_status_for(handoff.status)
    await db.commit()
    return {"status": handoff.status, "task_status": task.status}


@router.get("/status/{task_id}")
async def get_handoff_status(task_id: UUID, db: AsyncSession = Depends(get_db)):
    handoff = await _latest_handoff(db, task_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")
    stale = False
    result_summary = None
    try:
        data = await ec.get_task(handoff.echelon_task_id)
        handoff.status = data.get("status", handoff.status)
        result_summary = data.get("result_summary")
        task = await db.get(Task, task_id)
        if task is not None:
            task.status = task_status_for(handoff.status)
        await db.commit()
    except ec.EchelonError as e:
        stale = True  # say so; never pass stored status off as live
        log.warning("status refresh failed: %s", e.public_message())
    return {"handoff": handoff, "result_summary": result_summary, "stale": stale}


@router.get("/dashboards")
async def list_dashboards():
    _need_echelon()
    try:
        data = await ec.list_dashboards()
        dashboards = data.get("dashboards", [])
        if isinstance(dashboards, list):
            for item in dashboards:
                if isinstance(item, dict) and isinstance(item.get("path"), str):
                    item["href"] = f"{settings.ECHELON_BASE_URL.rstrip('/')}{item['path']}"
        return data
    except ec.EchelonError as exc:
        raise _refused(exc)


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str):
    _need_echelon()
    try:
        return await ec.get_dashboard(dashboard_id)
    except ec.EchelonError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        raise _refused(exc)
