"""Billing service: folio management, folio items, invoice retrieval."""
import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.models import Folio, FolioItem, Invoice, Stay, Property
from app.core.exceptions import TenantViolationError, InvoiceFinalizedError


class BillingService:
    async def add_item(
        self,
        db: AsyncSession,
        folio_id: uuid.UUID,
        category: str,
        description: str,
        quantity: Decimal,
        unit_price: Decimal,
        created_by: uuid.UUID,
        notes: Optional[str] = None,
    ) -> FolioItem:
        result = await db.execute(select(Folio).where(Folio.id == folio_id))
        folio = result.scalar_one_or_none()
        if not folio:
            raise TenantViolationError()
        if folio.is_finalized:
            raise InvoiceFinalizedError()

        item = FolioItem(
            folio_id=folio_id,
            category=category,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            total=quantity * unit_price,
            created_by=created_by,
            notes=notes,
        )
        db.add(item)
        await db.flush()
        return item


billing_service = BillingService()
