"""Properties service."""
import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status

from app.core.models import Property
from app.core.exceptions import TenantViolationError
from app.audit.service import audit_log


class PropertyService:

    async def get_all(self, db: AsyncSession, org_id: uuid.UUID) -> List[Property]:
        result = await db.execute(
            select(Property)
            .where(Property.organization_id == org_id, Property.is_active == True)
            .order_by(Property.name)
        )
        return result.scalars().all()

    async def get_by_id(self, db: AsyncSession, prop_id: uuid.UUID, org_id: uuid.UUID) -> Property:
        result = await db.execute(
            select(Property).where(Property.id == prop_id, Property.organization_id == org_id)
        )
        prop = result.scalar_one_or_none()
        if not prop:
            raise HTTPException(status_code=404, detail={"code": "PROPERTY_NOT_FOUND", "message": "Property not found"})
        return prop

    async def create(self, db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> Property:
        prop = Property(organization_id=org_id, **data)
        db.add(prop)
        await db.flush()
        await audit_log(db, "property.create", "property", str(prop.id), org_id, user_id, new_values=data)
        return prop

    async def update(self, db: AsyncSession, prop_id: uuid.UUID, org_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> Property:
        prop = await self.get_by_id(db, prop_id, org_id)
        old = {k: getattr(prop, k) for k in data}
        for k, v in data.items():
            if v is not None:
                setattr(prop, k, v)
        await audit_log(db, "property.update", "property", str(prop.id), org_id, user_id, old_values=old, new_values=data)
        return prop


property_service = PropertyService()
