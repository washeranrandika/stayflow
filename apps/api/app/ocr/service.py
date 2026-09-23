"""
OCR service abstraction.
Supports: mock (dev), Google Vision API, AWS Textract.
Configured via OCR_PROVIDER env var.
"""
import re
from typing import Optional
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class OCRService:

    async def extract_from_document(
        self,
        content: bytes,
        content_type: str,
        document_type: str,
    ) -> Optional[dict]:
        """
        Extract text fields from an ID document image.
        Returns extracted fields + confidence, or None if OCR not available.

        IMPORTANT: This is text extraction only.
        The result is NOT a verification of document authenticity.
        Staff must manually confirm all extracted fields.
        """
        provider = settings.OCR_PROVIDER

        if provider == "mock":
            return await self._mock_extract(document_type)
        elif provider == "google_vision":
            return await self._google_vision_extract(content, document_type)
        elif provider == "aws_textract":
            return await self._aws_textract_extract(content, document_type)
        else:
            logger.warning("Unknown OCR provider", provider=provider)
            return None

    async def _mock_extract(self, document_type: str) -> dict:
        """Mock OCR for development — returns fake extracted data."""
        logger.info("Using mock OCR provider")
        return {
            "document_number": "NIC123456789V",
            "full_name": "EXTRACTED NAME (Please verify)",
            "date_of_birth": None,
            "address": None,
            "confidence": 0.0,
            "raw": {"provider": "mock", "note": "This is mock data. In production, configure OCR_PROVIDER."},
        }

    async def _google_vision_extract(self, content: bytes, document_type: str) -> Optional[dict]:
        """Extract using Google Cloud Vision API."""
        try:
            from google.cloud import vision

            client = vision.ImageAnnotatorClient()
            image = vision.Image(content=content)
            response = client.text_detection(image=image)

            if response.error.message:
                logger.error("Google Vision error", error=response.error.message)
                return None

            full_text = response.full_text_annotation.text
            logger.info("Google Vision OCR completed", text_length=len(full_text))

            return {
                "raw": {"full_text": full_text, "provider": "google_vision"},
                "document_number": _extract_document_number(full_text, document_type),
                "full_name": None,  # Parsing logic would go here
                "confidence": 0.85,
            }
        except ImportError:
            logger.warning("google-cloud-vision not installed")
            return None
        except Exception as e:
            logger.error("Google Vision extraction failed", error=str(e))
            return None

    async def _aws_textract_extract(self, content: bytes, document_type: str) -> Optional[dict]:
        """Extract using AWS Textract."""
        try:
            import boto3
            client = boto3.client("textract", region_name=settings.STORAGE_REGION)
            response = client.detect_document_text(Document={"Bytes": content})

            blocks = [b["Text"] for b in response.get("Blocks", []) if b["BlockType"] == "LINE"]
            full_text = "\n".join(blocks)

            return {
                "raw": {"blocks": blocks, "provider": "aws_textract"},
                "document_number": _extract_document_number(full_text, document_type),
                "full_name": None,
                "confidence": 0.80,
            }
        except Exception as e:
            logger.error("AWS Textract extraction failed", error=str(e))
            return None


def _extract_document_number(text: str, document_type: str) -> Optional[str]:
    """
    Attempt to extract document numbers from raw OCR text.
    This is a best-effort extraction — staff must verify.
    """
    if document_type == "NATIONAL_ID":
        # Sri Lanka NIC pattern: 9 digits + V/X, or 12 digits
        m = re.search(r'\b(\d{9}[VX]|\d{12})\b', text, re.IGNORECASE)
        if m:
            return m.group(1)
    elif document_type == "PASSPORT":
        m = re.search(r'\b([A-Z]{1,2}\d{6,7})\b', text)
        if m:
            return m.group(1)
    return None


ocr_service = OCRService()
