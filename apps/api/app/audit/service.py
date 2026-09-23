"""
Audit log service — write audit entries from anywhere in the app.
This is the ONLY place that writes to audit_logs table.
"""
import uuid
from typing import Optional, Any
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import AuditLog


async def audit_log(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    organization_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """
    Write an audit log entry.
    This does NOT commit — caller is responsible for committing.
    """
    entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
