"""Housekeeping router."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import HousekeepingTask, Room, Property, HousekeepingStatusEnum, RoomStatusEnum, RoomStatusHistory
from app.core.responses import success, paginated
from app.audit.service import audit_log

router = APIRouter()


class UpdateTaskBody(BaseModel):
    status: str
    assigned_to: Optional[uuid.UUID] = None
    notes: Optional[str] = None


def _serialize(t):
    return {
        "id": str(t.id),
        "property_id": str(t.property_id),
        "room_id": str(t.room_id),
        "room": {"room_number": t.room.room_number, "status": t.room.status.value} if t.room else None,
        "assigned_to": str(t.assigned_to) if t.assigned_to else None,
        "status": t.status.value,
        "priority": t.priority.value,
        "notes": t.notes,
        "created_at": t.created_at.isoformat(),
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }


@router.get("/tasks", response_model=dict)
async def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    property_id: Optional[uuid.UUID] = Query(None),
    assigned_to: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.HOUSEKEEPING_VIEW)),
):
    query = (
        select(HousekeepingTask)
        .join(Property, HousekeepingTask.property_id == Property.id)
        .options(selectinload(HousekeepingTask.room))
        .where(Property.organization_id == current_user.organization_id)
    )

    if status:
        query = query.where(HousekeepingTask.status == status)
    if property_id:
        query = query.where(HousekeepingTask.property_id == property_id)
    if assigned_to:
        query = query.where(HousekeepingTask.assigned_to == assigned_to)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = query.order_by(HousekeepingTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    tasks = result.scalars().all()
    return paginated([_serialize(t) for t in tasks], page, page_size, total)


@router.patch("/tasks/{task_id}", response_model=dict)
async def update_task(
    task_id: uuid.UUID,
    body: UpdateTaskBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.HOUSEKEEPING_UPDATE)),
):
    result = await db.execute(
        select(HousekeepingTask)
        .join(Property, HousekeepingTask.property_id == Property.id)
        .options(selectinload(HousekeepingTask.room))
        .where(HousekeepingTask.id == task_id, Property.organization_id == current_user.organization_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": "Housekeeping task not found"})

    old_status = task.status
    task.status = HousekeepingStatusEnum(body.status)
    if body.assigned_to:
        task.assigned_to = body.assigned_to
    if body.notes:
        task.notes = body.notes

    # When completed: set room to AVAILABLE
    if body.status == "COMPLETED":
        task.completed_at = datetime.now(timezone.utc)
        if task.room and task.room.status == RoomStatusEnum.CLEANING:
            task.room.status = RoomStatusEnum.AVAILABLE
            db.add(RoomStatusHistory(
                room_id=task.room_id,
                from_status=RoomStatusEnum.CLEANING,
                to_status=RoomStatusEnum.AVAILABLE,
                changed_by=current_user.user_id,
                notes="Housekeeping completed",
            ))

    await audit_log(
        db, "housekeeping.task_update", "housekeeping_task", str(task_id),
        current_user.organization_id, current_user.user_id,
        old_values={"status": old_status.value},
        new_values={"status": body.status},
    )
    await db.commit()
    return success(data=_serialize(task), message="Task updated")
