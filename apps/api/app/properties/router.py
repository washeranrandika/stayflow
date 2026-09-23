"""Properties router."""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.responses import success
from app.properties.service import property_service

router = APIRouter()


class CreatePropertyBody(BaseModel):
    name: str
    address: str
    city: str
    country: str
    phone: Optional[str] = None
    email: Optional[str] = None
    timezone: str = "UTC"
    check_in_time: str = "14:00"
    check_out_time: str = "11:00"


class UpdatePropertyBody(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    timezone: Optional[str] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    is_active: Optional[bool] = None


def _serialize(p):
    return {
        "id": str(p.id),
        "organization_id": str(p.organization_id),
        "name": p.name,
        "address": p.address,
        "city": p.city,
        "country": p.country,
        "phone": p.phone,
        "email": p.email,
        "timezone": p.timezone,
        "check_in_time": p.check_in_time,
        "check_out_time": p.check_out_time,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


@router.get("", response_model=dict)
async def list_properties(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PROPERTY_VIEW)),
):
    props = await property_service.get_all(db, current_user.organization_id)
    return success(data=[_serialize(p) for p in props])


@router.post("", response_model=dict)
async def create_property(
    body: CreatePropertyBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PROPERTY_CREATE)),
):
    prop = await property_service.create(db, current_user.organization_id, current_user.user_id, body.model_dump())
    await db.commit()
    return success(data=_serialize(prop), message="Property created")


@router.get("/{property_id}", response_model=dict)
async def get_property(
    property_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PROPERTY_VIEW)),
):
    prop = await property_service.get_by_id(db, property_id, current_user.organization_id)
    return success(data=_serialize(prop))


@router.patch("/{property_id}", response_model=dict)
async def update_property(
    property_id: uuid.UUID,
    body: UpdatePropertyBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PROPERTY_UPDATE)),
):
    prop = await property_service.update(
        db, property_id, current_user.organization_id, current_user.user_id,
        {k: v for k, v in body.model_dump().items() if v is not None}
    )
    await db.commit()
    return success(data=_serialize(prop), message="Property updated")
