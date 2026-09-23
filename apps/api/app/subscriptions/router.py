"""Subscriptions router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser
from app.core.models import Subscription
from app.core.responses import success

router = APIRouter()


@router.get("/current", response_model=dict)
async def get_current_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(Subscription.organization_id == current_user.organization_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return success(data=None, message="No active subscription")

    return success(data={
        "id": str(sub.id),
        "status": sub.status,
        "plan": {
            "id": str(sub.plan.id),
            "name": sub.plan.name,
            "max_properties": sub.plan.max_properties,
            "max_rooms": sub.plan.max_rooms,
            "max_users": sub.plan.max_users,
        } if sub.plan else None,
        "current_period_start": sub.current_period_start.isoformat(),
        "current_period_end": sub.current_period_end.isoformat(),
    })
