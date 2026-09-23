"""
Notification service abstraction.
Handles FCM push notifications (and future WhatsApp/SMS/email).
In development: logs to console instead of sending.
"""
import uuid
from datetime import datetime
from typing import Optional
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class NotificationService:

    async def send_push(
        self,
        fcm_token: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> bool:
        """Send a push notification via FCM."""
        if settings.FCM_PROVIDER == "log":
            logger.info(
                "PUSH_NOTIFICATION (dev mode)",
                token=fcm_token[:20] + "...",
                title=title,
                body=body,
                data=data,
            )
            return True
        elif settings.FCM_PROVIDER == "firebase":
            return await self._send_fcm(fcm_token, title, body, data)
        return False

    async def _send_fcm(self, token: str, title: str, body: str, data: Optional[dict]) -> bool:
        try:
            import firebase_admin
            from firebase_admin import messaging

            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
                token=token,
            )
            messaging.send(message)
            logger.info("FCM notification sent", title=title)
            return True
        except Exception as e:
            logger.error("FCM send failed", error=str(e))
            return False

    async def schedule_checkout_reminders(
        self,
        stay_id: uuid.UUID,
        expected_checkout: datetime,
        org_id: uuid.UUID,
    ) -> None:
        """Schedule checkout reminder tasks via Celery."""
        if settings.DEBUG or settings.ENVIRONMENT == "development":
            logger.info("Checkout reminders logged (dev mode)", stay_id=str(stay_id), expected_checkout=expected_checkout.isoformat())
            return

        try:
            from app.notifications.tasks import schedule_checkout_reminder_task
            schedule_checkout_reminder_task.apply_async(
                args=[str(stay_id), expected_checkout.isoformat(), str(org_id)],
                countdown=1,
            )
            logger.info("Checkout reminders scheduled", stay_id=str(stay_id), expected_checkout=expected_checkout.isoformat())
        except Exception as e:
            logger.warning("Failed to schedule checkout reminders", error=str(e))

    async def notify_housekeeping_assigned(
        self,
        task_id: uuid.UUID,
        room_number: str,
        assignee_fcm_token: Optional[str] = None,
    ) -> None:
        if assignee_fcm_token:
            await self.send_push(
                fcm_token=assignee_fcm_token,
                title="Housekeeping Task Assigned",
                body=f"Please clean Room {room_number}",
                data={"task_id": str(task_id), "type": "HOUSEKEEPING_ASSIGNED"},
            )


notification_service = NotificationService()
