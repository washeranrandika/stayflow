"""Services router — extra services management."""
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import Service, ServiceOrder, Folio, Stay, Property, ServiceCategoryEnum
from app.core.responses import success
from app.core.exceptions import TenantViolationError, InvoiceFinalizedError
from app.audit.service import audit_log

router = APIRouter()


class CreateServiceBody(BaseModel):
    property_id: uuid.UUID
    category: str
    name: str
    description: Optional[str] = None
    unit_price: Decimal


class AddServiceOrderBody(BaseModel):
    stay_id: uuid.UUID
    service_id: uuid.UUID
    quantity: Decimal = Decimal("1")
    unit_price: Optional[Decimal] = None  # override
    notes: Optional[str] = None


@router.get("/by-property/{property_id}", response_model=dict)
async def list_services(
    property_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.SERVICE_VIEW)),
):
    result = await db.execute(
        select(Property).where(Property.id == property_id, Property.organization_id == current_user.organization_id)
    )
    if not result.scalar_one_or_none():
        raise TenantViolationError()

    result = await db.execute(
        select(Service).where(Service.property_id == property_id, Service.is_active == True).order_by(Service.category, Service.name)
    )
    services = result.scalars().all()
    return success(data=[{
        "id": str(s.id),
        "property_id": str(s.property_id),
        "category": s.category.value,
        "name": s.name,
        "description": s.description,
        "unit_price": float(s.unit_price),
        "is_active": s.is_active,
    } for s in services])


@router.post("", response_model=dict)
async def create_service(
    body: CreateServiceBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.SERVICE_CREATE)),
):
    result = await db.execute(
        select(Property).where(Property.id == body.property_id, Property.organization_id == current_user.organization_id)
    )
    if not result.scalar_one_or_none():
        raise TenantViolationError()

    service = Service(
        property_id=body.property_id,
        category=ServiceCategoryEnum(body.category),
        name=body.name,
        description=body.description,
        unit_price=body.unit_price,
    )
    db.add(service)
    await db.commit()
    return success(data={"id": str(service.id)}, message="Service created")


@router.post("/orders", response_model=dict)
async def add_service_order(
    body: AddServiceOrderBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.SERVICE_CREATE)),
):
    """Add a service to an active stay's folio."""
    # Verify stay belongs to org
    result = await db.execute(
        select(Stay)
        .join(Property, Stay.property_id == Property.id)
        .options(selectinload(Stay.folio))
        .where(Stay.id == body.stay_id, Property.organization_id == current_user.organization_id)
    )
    stay = result.scalar_one_or_none()
    if not stay:
        raise TenantViolationError()
    if stay.is_completed:
        raise HTTPException(status_code=400, detail={"code": "STAY_COMPLETED", "message": "Cannot add services to a completed stay"})

    # Verify service
    result = await db.execute(
        select(Service).where(Service.id == body.service_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail={"code": "SERVICE_NOT_FOUND", "message": "Service not found"})

    if stay.folio and stay.folio.is_finalized:
        raise InvoiceFinalizedError()

    unit_price = body.unit_price if body.unit_price is not None else service.unit_price
    total = unit_price * body.quantity

    order = ServiceOrder(
        stay_id=body.stay_id,
        folio_id=stay.folio.id if stay.folio else None,
        service_id=body.service_id,
        quantity=body.quantity,
        unit_price=unit_price,
        total=total,
        notes=body.notes,
        created_by=current_user.user_id,
    )
    db.add(order)

    # Also add to folio
    if stay.folio:
        from app.core.models import FolioItem
        folio_item = FolioItem(
            folio_id=stay.folio.id,
            category=service.category.value,
            description=service.name,
            quantity=body.quantity,
            unit_price=unit_price,
            total=total,
            created_by=current_user.user_id,
            notes=body.notes,
        )
        db.add(folio_item)

    await audit_log(db, "service.order", "service_order", None, current_user.organization_id, current_user.user_id,
                   new_values={"service": service.name, "total": float(total), "stay_id": str(body.stay_id)})
    await db.commit()
    return success(data={"order_id": str(order.id), "total": float(total)}, message="Service added to folio")
