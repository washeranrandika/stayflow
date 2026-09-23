"""Rooms router."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.responses import success
from app.rooms.service import room_service

router = APIRouter()


class CreateRoomBody(BaseModel):
    property_id: uuid.UUID
    room_type_id: uuid.UUID
    room_number: str
    floor: Optional[str] = None
    max_guests: Optional[int] = 2
    notes: Optional[str] = None


class UpdateRoomBody(BaseModel):
    room_type_id: Optional[uuid.UUID] = None
    floor: Optional[str] = None
    max_guests: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class UpdateRoomStatusBody(BaseModel):
    status: str
    notes: Optional[str] = None


def _serialize(r):
    rt = r.room_type
    return {
        "id": str(r.id),
        "property_id": str(r.property_id),
        "room_type_id": str(r.room_type_id),
        "room_type": {
            "id": str(rt.id),
            "name": rt.name,
            "is_ac": rt.is_ac,
            "max_guests": rt.max_guests,
            "base_hourly_rate": float(rt.base_hourly_rate),
            "base_nightly_rate": float(rt.base_nightly_rate),
        } if rt else None,
        "room_number": r.room_number,
        "floor": r.floor,
        "max_guests": r.max_guests,
        "status": r.status.value,
        "is_active": r.is_active,
        "notes": r.notes,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


@router.get("/by-property/{property_id}", response_model=dict)
async def list_rooms_by_property(
    property_id: uuid.UUID,
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_VIEW)),
):
    rooms = await room_service.get_rooms_for_property(db, property_id, current_user.organization_id, status)
    return success(data=[_serialize(r) for r in rooms])


@router.post("", response_model=dict)
async def create_room(
    body: CreateRoomBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_CREATE)),
):
    room = await room_service.create(db, current_user.organization_id, current_user.user_id, body.model_dump())
    await db.commit()
    return success(data=_serialize(room), message="Room created")


@router.get("/{room_id}", response_model=dict)
async def get_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_VIEW)),
):
    room = await room_service.get_by_id(db, room_id, current_user.organization_id)
    return success(data=_serialize(room))


@router.patch("/{room_id}/status", response_model=dict)
async def update_room_status(
    room_id: uuid.UUID,
    body: UpdateRoomStatusBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.ROOM_STATUS_UPDATE)),
):
    room = await room_service.update_status(
        db, room_id, current_user.organization_id, current_user.user_id,
        body.status, body.notes,
    )
    await db.commit()
    return success(data=_serialize(room), message="Room status updated")
