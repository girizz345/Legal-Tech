"""Celery tasks.

scan_obligations_task — runs daily (configured in Celery Beat).
  Marks obligations as "overdue" when their due_date has passed.
  In a production system this would also trigger email/SMS reminders.
"""
from __future__ import annotations

import time
from datetime import datetime

from app.worker.celery_app import celery_app


@celery_app.task(name="ping_task")
def ping_task(message: str = "pong") -> str:
    time.sleep(1)
    return f"ping_task received: {message}"


@celery_app.task(name="scan_obligations_task")
def scan_obligations_task() -> dict:
    """Daily scan: mark past-due obligations as overdue."""
    from app.core.db import SessionLocal
    from app.models.contract import Obligation

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        rows = (
            db.query(Obligation)
            .filter(Obligation.status == "pending", Obligation.due_date < now)
            .all()
        )
        for o in rows:
            o.status = "overdue"
        db.commit()
        return {"marked_overdue": len(rows), "scanned_at": now.isoformat()}
    finally:
        db.close()
