"""
Celery tasks for notifications and checkout alerts.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog

from app.core.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.notifications.tasks.schedule_checkout_reminder_task")
def schedule_checkout_reminder_task(stay_id: str, expected_checkout_iso: str, org_id: str):
    """
    Schedule checkout alert notifications.
    Sends alerts at: 15 min before, at checkout time, and if overdue.
    """
    import asyncio
    from sqlalchemy import create_engine
    from app.core.config import settings

    expected_checkout = datetime.fromisoformat(expected_checkout_iso)
    now = datetime.now(timezone.utc)

    # Schedule 15-minute warning
    fifteen_min_before = expected_checkout - timedelta(minutes=15)
    if fifteen_min_before > now:
        delay_seconds = (fifteen_min_before - now).total_seconds()
        send_checkout_warning.apply_async(
            args=[stay_id, "15_min_warning"],
            countdown=int(delay_seconds),
        )

    # Schedule at checkout time
    if expected_checkout > now:
        delay_seconds = (expected_checkout - now).total_seconds()
        send_checkout_warning.apply_async(
            args=[stay_id, "checkout_time"],
            countdown=int(delay_seconds),
        )

    # Schedule 30-min overdue alert
    thirty_min_after = expected_checkout + timedelta(minutes=30)
    if thirty_min_after > now:
        delay_seconds = (thirty_min_after - now).total_seconds()
        send_checkout_warning.apply_async(
            args=[stay_id, "overdue"],
            countdown=int(delay_seconds),
        )

    logger.info("Checkout reminders scheduled", stay_id=stay_id)


@celery_app.task(name="app.notifications.tasks.send_checkout_warning")
def send_checkout_warning(stay_id: str, alert_type: str):
    """Send checkout warning notification to staff."""
    logger.info("Sending checkout alert", stay_id=stay_id, alert_type=alert_type)
    # In production: query active FCM tokens for org staff and send push notifications


@celery_app.task(name="app.notifications.tasks.send_checkout_alerts")
def send_checkout_alerts():
    """
    Periodic task (every 5 min via beat): check for approaching/overdue checkouts
    and send push notifications to authorized staff.
    """
    logger.info("Running checkout alerts check")
    # In production: query stays where expected_checkout is within 15 min
    # and send FCM push notifications to relevant staff members
