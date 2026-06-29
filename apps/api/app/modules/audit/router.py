"""Audit log — append-only event trail, readable by admins."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.audit import AuditLog
from app.models.user import UserRole
from app.modules.auth.dependencies import require_role

router = APIRouter()


class AuditLogOut(BaseModel):
    id: uuid.UUID
    actor_id: Optional[uuid.UUID] = None
    action: str
    target: Optional[str] = None
    at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[AuditLogOut])
def list_audit_log(
    limit: int = 200,
    action_prefix: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.admin)),
):
    q = db.query(AuditLog)
    if action_prefix:
        q = q.filter(AuditLog.action.like(f"{action_prefix}%"))
    return q.order_by(AuditLog.at.desc()).limit(min(limit, 1000)).all()
