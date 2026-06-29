import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def write_audit(
    db: Session,
    actor_id: Optional[uuid.UUID],
    action: str,
    target: Optional[str] = None,
) -> None:
    """Persist a single audit event. Call after the primary DB commit."""
    db.add(AuditLog(actor_id=actor_id, action=action, target=target))
    db.commit()
