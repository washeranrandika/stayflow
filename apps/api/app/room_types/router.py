"""Room types router."""
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from decimal import Decimal

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import RoomType, Property
from app.core.responses import success
from app.core.exceptions import TenantViolationError
from app.audit.service import audit_log

router = APIRouter()


class CreateRoomTypeBody(BaseModel):
    property_id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_ac: bool = True
    max_guests: int = 2
    base_hourly_rate: Decimal = Decimal("0")
    base_day_use_rate: Decimal = Decimal("0")
    base_nightly_rate: Decimal = Decimal("0")
    base_daily_rate: Decimal = Decimal("0")
    extra_hour_rate: Decimal = Decimal("0")
    extra_guest_rate: Decimal = Decimal("0")


class UpdateRoomTypeBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_ac: Optional[bool] = None
    max_guests: Optional[int] = None
    base_hourly_rate: Optional[Decimal] = None
    base_day_use_rate: Optional[Decimal] = None
    base_nightly_rate: Optional[Decimal] = None
    base_daily_rate: Optional[Decimal] = None
    extra_hour_rate: Optional[Decimal] = None
    extra_guest_rate: Optional[Decimal] = None


def _serialize(rt):
    return {
        "id": str(rt.id),
        "property_id": str(rt.property_id),
        "name": rt.name,
        "description": rt.description,
        "is_ac": rt.is_ac,
        "max_guests": rt.max_guests,
        "base_hourly_rate": float(rt.base_hourly_rate),
        "base_day_use_rate": float(rt.base_day_use_rate),
        "base_nightly_rate": float(rt.base_nightly_rate),
        "base_daily_rate": float(rt.base_daily_rate),
        "extra_hour_rate": float(rt.extra_hour_rate),
        "extra_guest_rate": float(rt.extra_guest_rate),
        "created_at": rt.created_at.isoformat(),
        "updated_at": rt.updated_at.isoformat(),
    }


async def _verify_property_org(db, property_id, org_id):
    result = await db.execute(select(Property).where(Property.id == property_id, Property.organization_id == org_id))
    if not result.scalar_one_or_none():
        raise TenantViolationError()


@router.get("/by-property/{property_id}", response_model=dict)
async def list_room_types(
    property_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_TYPE_VIEW)),
):
    await _verify_property_org(db, property_id, current_user.organization_id)
    result = await db.execute(select(RoomType).where(RoomType.property_id == property_id).order_by(RoomType.name))
    return success(data=[_serialize(rt) for rt in result.scalars().all()])


@router.post("", response_model=dict)
async def create_room_type(
    body: CreateRoomTypeBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_TYPE_CREATE)),
):
    await _verify_property_org(db, body.property_id, current_user.organization_id)
    rt = RoomType(**body.model_dump())
    db.add(rt)
    await db.flush()
    await audit_log(db, "room_type.create", "room_type", str(rt.id), current_user.organization_id, current_user.user_id)
    await db.commit()
    return success(data=_serialize(rt), message="Room type created")


@router.get("/{room_type_id}", response_model=dict)
async def get_room_type(
    room_type_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_TYPE_VIEW)),
):
    result = await db.execute(
        select(RoomType)
        .join(Property, RoomType.property_id == Property.id)
        .where(RoomType.id == room_type_id, Property.organization_id == current_user.organization_id)
    )
    rt = result.scalar_one_or_none()
    if not rt:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "ROOM_TYPE_NOT_FOUND", "message": "Room type not found"})
    return success(data=_serialize(rt))


@router.patch("/{room_type_id}", response_model=dict)
async def update_room_type(
    room_type_id: uuid.UUID,
    body: UpdateRoomTypeBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_TYPE_UPDATE)),
):
    result = await db.execute(
        select(RoomType)
        .join(Property, RoomType.property_id == Property.id)
        .where(RoomType.id == room_type_id, Property.organization_id == current_user.organization_id)
    )
    rt = result.scalar_one_or_none()
    if not rt:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "ROOM_TYPE_NOT_FOUND", "message": "Room type not found"})

    old = {}
    for k, v in body.model_dump(exclude_none=True).items():
        old[k] = getattr(rt, k)
        setattr(rt, k, v)

    await audit_log(db, "room_type.update", "room_type", str(rt.id), current_user.organization_id, current_user.user_id,
                   old_values=old, new_values=body.model_dump(exclude_none=True))
    await db.commit()
    return success(data=_serialize(rt), message="Room type updated")
