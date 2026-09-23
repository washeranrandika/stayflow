"""Billing router — folios and invoices."""
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
from app.core.models import Folio, Invoice, FolioItem, Stay, Property
from app.core.responses import success
from app.core.exceptions import TenantViolationError, InvoiceFinalizedError
from app.audit.service import audit_log

router = APIRouter()


class AddFolioItemBody(BaseModel):
    category: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    notes: Optional[str] = None


def _serialize_folio(f):
    return {
        "id": str(f.id),
        "stay_id": str(f.stay_id),
        "is_finalized": f.is_finalized,
        "items": [{
            "id": str(i.id),
            "category": i.category,
            "description": i.description,
            "quantity": float(i.quantity),
            "unit_price": float(i.unit_price),
            "total": float(i.total),
            "created_at": i.created_at.isoformat(),
        } for i in (f.items or [])],
        "total": float(sum(i.total for i in (f.items or []))),
    }


def _serialize_invoice(inv):
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "stay_id": str(inv.stay_id),
        "guest_id": str(inv.guest_id),
        "room_charge": float(inv.room_charge),
        "services_total": float(inv.services_total),
        "discount": float(inv.discount),
        "tax": float(inv.tax),
        "grand_total": float(inv.grand_total),
        "is_finalized": inv.is_finalized,
        "finalized_at": inv.finalized_at.isoformat() if inv.finalized_at else None,
        "payments": [{
            "id": str(p.id),
            "payment_method": p.payment_method.value,
            "amount": float(p.amount),
            "created_at": p.created_at.isoformat(),
        } for p in (inv.payments or [])],
        "paid_amount": float(sum(p.amount for p in (inv.payments or []))),
        "balance": float(inv.grand_total - sum(p.amount for p in (inv.payments or []))),
        "created_at": inv.created_at.isoformat(),
    }


async def _get_folio_verified(db, folio_id, org_id) -> Folio:
    result = await db.execute(
        select(Folio)
        .join(Stay, Folio.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .options(selectinload(Folio.items))
        .where(Folio.id == folio_id, Property.organization_id == org_id)
    )
    folio = result.scalar_one_or_none()
    if not folio:
        raise TenantViolationError()
    return folio


@router.get("/folios/{folio_id}", response_model=dict)
async def get_folio(
    folio_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.INVOICE_VIEW)),
):
    folio = await _get_folio_verified(db, folio_id, current_user.organization_id)
    return success(data=_serialize_folio(folio))


@router.post("/folios/{folio_id}/items", response_model=dict)
async def add_folio_item(
    folio_id: uuid.UUID,
    body: AddFolioItemBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.INVOICE_CREATE)),
):
    folio = await _get_folio_verified(db, folio_id, current_user.organization_id)

    if folio.is_finalized:
        raise InvoiceFinalizedError()

    item = FolioItem(
        folio_id=folio_id,
        category=body.category,
        description=body.description,
        quantity=body.quantity,
        unit_price=body.unit_price,
        total=body.quantity * body.unit_price,
        created_by=current_user.user_id,
        notes=body.notes,
    )
    db.add(item)
    await audit_log(db, "folio.add_item", "folio_item", None, current_user.organization_id, current_user.user_id,
                   new_values={"description": body.description, "total": float(item.total)})
    await db.commit()
    return success(data={"item_id": str(item.id), "total": float(item.total)}, message="Item added to folio")


@router.get("/invoices", response_model=dict)
async def list_invoices(
    property_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.INVOICE_VIEW)),
):
    query = (
        select(Invoice)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .options(selectinload(Invoice.payments))
        .where(Property.organization_id == current_user.organization_id)
    )
    if property_id:
        query = query.where(Stay.property_id == property_id)

    result = await db.execute(query.order_by(Invoice.created_at.desc()))
    invoices = result.scalars().all()
    return success(data=[_serialize_invoice(inv) for inv in invoices])


@router.get("/invoices/{invoice_id}", response_model=dict)
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.INVOICE_VIEW)),
):
    result = await db.execute(
        select(Invoice)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Property.organization_id == current_user.organization_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail={"code": "INVOICE_NOT_FOUND", "message": "Invoice not found"})
    return success(data=_serialize_invoice(invoice))
