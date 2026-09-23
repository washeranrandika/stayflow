"""Audit log router."""
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import AuditLog, User
from app.core.responses import paginated

router = APIRouter()


@router.get("", response_model=dict)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.AUDIT_VIEW)),
):
    query = select(AuditLog).where(
        AuditLog.organization_id == current_user.organization_id
    )

    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if from_date:
        query = query.where(AuditLog.created_at >= from_date)
    if to_date:
        query = query.where(AuditLog.created_at <= to_date)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    return paginated(
        data=[{
            "id": str(log.id),
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "user_id": str(log.user_id) if log.user_id else None,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        } for log in logs],
        page=page,
        page_size=page_size,
        total=total,
    )
