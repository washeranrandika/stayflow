"""
Identity / ID Document module.
Handles secure document upload, OCR abstraction, and verification workflow.

Security:
- Documents stored in private S3 bucket (never public)
- Access controlled by permission (guest.document.view)
- All access is audit logged
- Signed URLs with short expiry for viewing
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_permission, CurrentUser
from app.core.permissions import Permission
from app.core.models import GuestDocument, GuestVerification, Guest, VerificationStatusEnum, DocumentTypeEnum
from app.core.responses import success
from app.core.exceptions import TenantViolationError, GuestDocumentAccessDenied
from app.audit.service import audit_log
from app.storage.service import storage_service
from app.ocr.service import ocr_service

router = APIRouter()


async def _verify_guest_org(db, guest_id, org_id):
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.organization_id == org_id)
    )
    guest = result.scalar_one_or_none()
    if not guest:
        raise TenantViolationError()
    return guest


@router.post("/documents", response_model=dict)
async def upload_document(
    guest_id: uuid.UUID = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_DOCUMENT_VIEW)),
):
    """Upload an ID document for a guest. Stored privately in object storage."""
    await _verify_guest_org(db, guest_id, current_user.organization_id)

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail={"code": "INVALID_FILE_TYPE", "message": "Only JPEG, PNG, WebP, and PDF files are allowed"})

    # Validate file size (10MB max)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail={"code": "FILE_TOO_LARGE", "message": "File must be under 10MB"})

    # Upload to private storage
    file_key = await storage_service.upload_document(
        content=content,
        content_type=file.content_type,
        guest_id=guest_id,
        org_id=current_user.organization_id,
    )

    # Create document record
    doc = GuestDocument(
        guest_id=guest_id,
        document_type=DocumentTypeEnum(document_type),
        file_key=file_key,
        file_size=len(content),
        content_type=file.content_type,
        created_by=current_user.user_id,
    )
    db.add(doc)
    await db.flush()

    # Create initial verification record
    verification = GuestVerification(
        guest_id=guest_id,
        document_id=doc.id,
        status=VerificationStatusEnum.PENDING,
    )
    db.add(verification)

    # Run OCR asynchronously (abstracted provider)
    ocr_result = await ocr_service.extract_from_document(content, file.content_type, document_type)

    if ocr_result:
        doc.ocr_raw = ocr_result.get("raw")
        doc.ocr_confidence = ocr_result.get("confidence")
        # Pre-populate fields from OCR (user must confirm)
        if ocr_result.get("document_number"):
            doc.document_number = ocr_result["document_number"]
        if ocr_result.get("full_name"):
            doc.full_name = ocr_result["full_name"]

    await audit_log(
        db, "guest.document.upload", "guest_document", str(doc.id),
        current_user.organization_id, current_user.user_id,
        new_values={"guest_id": str(guest_id), "document_type": document_type}
    )
    await db.commit()

    return success(data={
        "document_id": str(doc.id),
        "document_type": document_type,
        "ocr_extracted": {
            "document_number": doc.document_number,
            "full_name": doc.full_name,
            "date_of_birth": doc.date_of_birth.isoformat() if doc.date_of_birth else None,
            "confidence": float(doc.ocr_confidence) if doc.ocr_confidence else None,
        } if ocr_result else None,
        "verification_id": str(verification.id),
        "verification_status": verification.status.value,
    }, message="Document uploaded. Please review OCR results and confirm.")


@router.get("/documents/{document_id}/url", response_model=dict)
async def get_document_signed_url(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_DOCUMENT_VIEW)),
):
    """Get a temporary signed URL to view a document. Audit logged."""
    result = await db.execute(
        select(GuestDocument)
        .join(Guest, GuestDocument.guest_id == Guest.id)
        .where(GuestDocument.id == document_id, Guest.organization_id == current_user.organization_id, GuestDocument.deleted_at.is_(None))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"})

    signed_url = await storage_service.get_signed_url(doc.file_key)

    await audit_log(
        db, "guest.document.view", "guest_document", str(document_id),
        current_user.organization_id, current_user.user_id,
    )
    await db.commit()

    return success(data={"signed_url": signed_url, "expires_in_seconds": 3600})


class ConfirmVerificationBody(BaseModel):
    document_id: uuid.UUID
    document_number: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    status: str  # CONFIRMED or REJECTED
    notes: Optional[str] = None


@router.post("/verifications", response_model=dict)
async def confirm_verification(
    body: ConfirmVerificationBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission(Permission.GUEST_DOCUMENT_VIEW)),
):
    """Staff reviews OCR output and confirms or rejects the verification."""
    result = await db.execute(
        select(GuestDocument)
        .join(Guest, GuestDocument.guest_id == Guest.id)
        .where(GuestDocument.id == body.document_id, Guest.organization_id == current_user.organization_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise TenantViolationError()

    # Update document with confirmed fields
    if body.document_number:
        doc.document_number = body.document_number
    if body.full_name:
        doc.full_name = body.full_name
    if body.address:
        doc.address = body.address

    # Update verification record
    result = await db.execute(
        select(GuestVerification).where(GuestVerification.document_id == body.document_id)
    )
    verification = result.scalar_one_or_none()
    if verification:
        verification.status = VerificationStatusEnum(body.status)
        verification.verified_by = current_user.user_id
        verification.notes = body.notes

    await audit_log(
        db, "guest.document.verify", "guest_verification", str(verification.id) if verification else None,
        current_user.organization_id, current_user.user_id,
        new_values={"status": body.status, "document_id": str(body.document_id)}
    )
    await db.commit()

    return success(data={"verification_status": body.status}, message=f"Verification {body.status.lower()}")
