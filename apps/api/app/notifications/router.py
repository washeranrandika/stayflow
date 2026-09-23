"""Notifications router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser
from app.core.models import Notification
from app.core.responses import success

router = APIRouter()


@router.get("", response_model=dict)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.organization_id == current_user.organization_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()
    return success(data=[{
        "id": str(n.id),
        "event": n.event.value,
        "title": n.title,
        "body": n.body,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    } for n in notifications])
