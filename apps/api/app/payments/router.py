"""Payments router."""
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
from app.core.models import Invoice, Payment, Refund, Stay, Property
from app.core.responses import success
from app.core.exceptions import TenantViolationError
from app.audit.service import audit_log

router = APIRouter()


class CreatePaymentBody(BaseModel):
    payment_method: str
    amount: Decimal
    reference: Optional[str] = None
    notes: Optional[str] = None


class CreateRefundBody(BaseModel):
    payment_id: uuid.UUID
    amount: Decimal
    reason: str


async def _get_invoice_verified(db, invoice_id, org_id) -> Invoice:
    result = await db.execute(
        select(Invoice)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .options(selectinload(Invoice.payments).selectinload(Payment.refunds))
        .where(Invoice.id == invoice_id, Property.organization_id == org_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise TenantViolationError()
    return invoice


@router.post("/invoices/{invoice_id}/payments", response_model=dict)
async def create_payment(
    invoice_id: uuid.UUID,
    body: CreatePaymentBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PAYMENT_CREATE)),
):
    invoice = await _get_invoice_verified(db, invoice_id, current_user.organization_id)

    # Validate amount
    paid_so_far = sum(p.amount - sum(r.amount for r in p.refunds) for p in invoice.payments)
    balance = invoice.grand_total - paid_so_far

    if body.amount <= 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_AMOUNT", "message": "Payment amount must be positive"})
    if body.amount > balance:
        raise HTTPException(
            status_code=400,
            detail={"code": "OVERPAYMENT", "message": f"Payment {body.amount} exceeds balance {balance:.2f}"}
        )

    from app.core.models import PaymentMethodEnum
    payment = Payment(
        invoice_id=invoice_id,
        payment_method=PaymentMethodEnum(body.payment_method),
        amount=body.amount,
        reference=body.reference,
        notes=body.notes,
        created_by=current_user.user_id,
    )
    db.add(payment)
    await db.flush()

    await audit_log(
        db, "payment.create", "payment", str(payment.id), current_user.organization_id, current_user.user_id,
        new_values={"amount": float(body.amount), "method": body.payment_method, "invoice_id": str(invoice_id)}
    )
    await db.commit()

    new_balance = float(balance - body.amount)
    return success(data={
        "payment_id": str(payment.id),
        "amount": float(body.amount),
        "balance": new_balance,
        "is_settled": new_balance <= 0,
    }, message="Payment recorded")


@router.get("", response_model=dict)
async def list_all_payments(
    property_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PAYMENT_VIEW)),
):
    query = (
        select(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .options(selectinload(Payment.refunds))
        .where(Property.organization_id == current_user.organization_id)
        .order_by(Payment.created_at.desc())
    )
    if property_id:
        query = query.where(Property.id == property_id)

    result = await db.execute(query)
    payments = result.scalars().all()

    return success(data=[{
        "id": str(p.id),
        "invoice_id": str(p.invoice_id),
        "payment_method": p.payment_method.value if hasattr(p.payment_method, "value") else str(p.payment_method),
        "amount": float(p.amount),
        "reference": p.reference,
        "notes": p.notes,
        "created_at": p.created_at.isoformat(),
        "refunds": [{"id": str(r.id), "amount": float(r.amount), "reason": r.reason} for r in p.refunds],
    } for p in payments])


@router.get("/invoices/{invoice_id}/payments", response_model=dict)
async def list_payments(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PAYMENT_VIEW)),
):
    invoice = await _get_invoice_verified(db, invoice_id, current_user.organization_id)
    paid = sum(p.amount - sum(r.amount for r in p.refunds) for p in invoice.payments)
    return success(data={
        "invoice_id": str(invoice_id),
        "grand_total": float(invoice.grand_total),
        "paid_amount": float(paid),
        "balance": float(invoice.grand_total - paid),
        "payments": [{
            "id": str(p.id),
            "payment_method": p.payment_method.value,
            "amount": float(p.amount),
            "reference": p.reference,
            "created_at": p.created_at.isoformat(),
            "refunds": [{"id": str(r.id), "amount": float(r.amount), "reason": r.reason} for r in p.refunds],
        } for p in invoice.payments],
    })


@router.post("/{payment_id}/refund", response_model=dict)
async def create_refund(
    payment_id: uuid.UUID,
    body: CreateRefundBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.PAYMENT_REFUND)),
):
    result = await db.execute(
        select(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .join(Stay, Invoice.stay_id == Stay.id)
        .join(Property, Stay.property_id == Property.id)
        .options(selectinload(Payment.refunds))
        .where(Payment.id == payment_id, Property.organization_id == current_user.organization_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise TenantViolationError()

    already_refunded = sum(r.amount for r in payment.refunds)
    max_refund = payment.amount - already_refunded
    if body.amount > max_refund:
        raise HTTPException(
            status_code=400,
            detail={"code": "REFUND_EXCEEDS_PAYMENT", "message": f"Refund cannot exceed {max_refund:.2f}"}
        )

    refund = Refund(
        payment_id=payment_id,
        amount=body.amount,
        reason=body.reason,
        created_by=current_user.user_id,
    )
    db.add(refund)
    await audit_log(
        db, "payment.refund", "refund", None, current_user.organization_id, current_user.user_id,
        new_values={"amount": float(body.amount), "reason": body.reason, "payment_id": str(payment_id)}
    )
    await db.commit()
    return success(data={"refund_id": str(refund.id), "amount": float(body.amount)}, message="Refund processed")
