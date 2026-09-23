"""Payment service: recording payments and processing refunds."""
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.models import Invoice, Payment, Refund, PaymentMethodEnum
from app.core.exceptions import TenantViolationError


class PaymentService:
    async def record_payment(
        self,
        db: AsyncSession,
        invoice_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        amount: Decimal,
        method: PaymentMethodEnum | str,
        reference: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Payment:
        result = await db.execute(
            select(Invoice)
            .options(selectinload(Invoice.payments).selectinload(Payment.refunds))
            .where(Invoice.id == invoice_id)
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise TenantViolationError()

        paid_so_far = sum(p.amount - sum(r.amount for r in p.refunds) for p in invoice.payments)
        balance = invoice.grand_total - paid_so_far

        if amount <= 0:
            raise HTTPException(status_code=400, detail={"code": "INVALID_AMOUNT", "message": "Payment amount must be positive"})
        if amount > balance:
            raise HTTPException(
                status_code=400,
                detail={"code": "OVERPAYMENT", "message": f"Payment {amount} exceeds balance {balance:.2f}"}
            )

        pay_enum = method if isinstance(method, PaymentMethodEnum) else PaymentMethodEnum(method)
        payment = Payment(
            invoice_id=invoice_id,
            payment_method=pay_enum,
            amount=amount,
            reference=reference,
            notes=notes,
            created_by=user_id,
        )
        db.add(payment)
        await db.flush()
        return payment

    async def refund_payment(
        self,
        db: AsyncSession,
        payment_id: uuid.UUID,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        amount: Decimal,
        reason: str,
    ) -> Refund:
        result = await db.execute(
            select(Payment)
            .options(selectinload(Payment.refunds))
            .where(Payment.id == payment_id)
        )
        payment = result.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=404, detail={"code": "PAYMENT_NOT_FOUND", "message": "Payment not found"})

        already_refunded = sum(r.amount for r in payment.refunds)
        max_refundable = payment.amount - already_refunded

        if amount <= 0:
            raise HTTPException(status_code=400, detail={"code": "INVALID_AMOUNT", "message": "Refund amount must be positive"})
        if amount > max_refundable:
            raise HTTPException(
                status_code=400,
                detail={"code": "REFUND_EXCEEDS_PAYMENT", "message": f"Cannot refund {amount}. Maximum refundable is {max_refundable:.2f}"}
            )

        refund = Refund(
            payment_id=payment_id,
            amount=amount,
            reason=reason,
            created_by=user_id,
        )
        db.add(refund)
        await db.flush()
        return refund


payment_service = PaymentService()
