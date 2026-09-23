"""
Storage service abstraction.
Supports MinIO (local dev) and AWS S3 (production).
Configured via STORAGE_PROVIDER env var.
"""
import uuid
from typing import Optional
import boto3
from botocore.config import Config
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class StorageService:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.STORAGE_ENDPOINT_URL if settings.STORAGE_PROVIDER == "minio" else None,
                aws_access_key_id=settings.STORAGE_ACCESS_KEY,
                aws_secret_access_key=settings.STORAGE_SECRET_KEY,
                region_name=settings.STORAGE_REGION,
                config=Config(signature_version="s3v4"),
            )
        return self._client

    def _make_document_key(self, org_id: uuid.UUID, guest_id: uuid.UUID, file_id: uuid.UUID, suffix: str) -> str:
        """Generate a private storage key for a document."""
        return f"orgs/{org_id}/guests/{guest_id}/documents/{file_id}{suffix}"

    async def upload_document(
        self,
        content: bytes,
        content_type: str,
        guest_id: uuid.UUID,
        org_id: uuid.UUID,
    ) -> str:
        """Upload a document to private storage. Returns the file key."""
        file_id = uuid.uuid4()
        suffix = ".pdf" if content_type == "application/pdf" else ".jpg"
        key = self._make_document_key(org_id, guest_id, file_id, suffix)

        try:
            self.client.put_object(
                Bucket=settings.STORAGE_BUCKET_DOCUMENTS,
                Key=key,
                Body=content,
                ContentType=content_type,
                ServerSideEncryption="AES256",
                Metadata={
                    "org-id": str(org_id),
                    "guest-id": str(guest_id),
                },
            )
            logger.info("document_uploaded", key=key, size=len(content))
        except Exception as e:
            logger.error("document_upload_failed", error=str(e), key=key)
            raise

        return key

    async def get_signed_url(self, file_key: str) -> str:
        """Generate a temporary signed URL for private document access."""
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.STORAGE_BUCKET_DOCUMENTS,
                    "Key": file_key,
                },
                ExpiresIn=settings.STORAGE_SIGNED_URL_EXPIRES,
            )
            return url
        except Exception as e:
            logger.error("signed_url_generation_failed", error=str(e))
            raise

    async def delete_document(self, file_key: str) -> None:
        """Permanently delete a document from storage."""
        try:
            self.client.delete_object(
                Bucket=settings.STORAGE_BUCKET_DOCUMENTS,
                Key=file_key,
            )
            logger.info("document_deleted", key=file_key)
        except Exception as e:
            logger.error("document_deletion_failed", error=str(e))
            raise


storage_service = StorageService()
