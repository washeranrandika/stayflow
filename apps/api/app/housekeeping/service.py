"""Housekeeping service."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.models import HousekeepingTask, Room, HousekeepingStatusEnum, RoomStatusEnum, RoomStatusHistory


class HousekeepingService:
    async def update_task_status(
        self,
        db: AsyncSession,
        task_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        status: HousekeepingStatusEnum | str,
        assigned_to: Optional[uuid.UUID] = None,
        notes: Optional[str] = None,
    ) -> HousekeepingTask:
        result = await db.execute(
            select(HousekeepingTask)
            .options(selectinload(HousekeepingTask.room))
            .where(HousekeepingTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": "Housekeeping task not found"})

        status_enum = status if isinstance(status, HousekeepingStatusEnum) else HousekeepingStatusEnum(status)
        task.status = status_enum
        if assigned_to:
            task.assigned_to = assigned_to
        if notes:
            task.notes = notes

        if status_enum == HousekeepingStatusEnum.COMPLETED:
            task.completed_at = datetime.now(timezone.utc)
            if task.room and task.room.status == RoomStatusEnum.CLEANING:
                task.room.status = RoomStatusEnum.AVAILABLE
                db.add(RoomStatusHistory(
                    room_id=task.room_id,
                    from_status=RoomStatusEnum.CLEANING,
                    to_status=RoomStatusEnum.AVAILABLE,
                    changed_by=user_id,
                    notes="Housekeeping completed",
                ))
        await db.flush()
        return task


housekeeping_service = HousekeepingService()
