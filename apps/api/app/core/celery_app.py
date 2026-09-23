"""Celery application configuration."""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "stayflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.notifications.tasks",
        "app.housekeeping.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        # Check for approaching checkouts every 5 minutes
        "checkout-alerts": {
            "task": "app.notifications.tasks.send_checkout_alerts",
            "schedule": 300.0,  # every 5 minutes
        },
    },
)
