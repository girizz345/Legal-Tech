"""Reminders — upcoming obligation due dates.

Obligations are populated from:
  • Uploaded contracts: the extraction pipeline writes due dates into contract_terms,
    and the reminder scan task converts them into Obligation rows.
  • (Future) Generated contracts: the template author can declare obligations.

The Celery task scan_obligations_task runs daily and marks overdue items.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.contract import Contract, Obligation
from app.models.user import User
from app.modules.auth.dependencies import get_current_user

router = APIRouter()

DEFAULT_LOOKAHEAD_DAYS = 30


class ObligationOut(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    type: str
    due_date: Optional[datetime] = None
    notice_days: Optional[int] = None
    status: str
    days_until_due: Optional[int] = None

    class Config:
        from_attributes = True


class ObligationCreateRequest(BaseModel):
    contract_id: uuid.UUID
    type: str
    due_date: Optional[datetime] = None
    notice_days: Optional[int] = None


@router.get("/", response_model=list[ObligationOut])
def list_reminders(
    lookahead_days: int = DEFAULT_LOOKAHEAD_DAYS,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return pending obligations due within the lookahead window (default 30 days)."""
    user_contract_ids = (
        db.query(Contract.id).filter(Contract.user_id == current_user.id).subquery()
    )
    cutoff = datetime.utcnow() + timedelta(days=lookahead_days)

    rows = (
        db.query(Obligation)
        .filter(
            Obligation.contract_id.in_(user_contract_ids),
            Obligation.status == "pending",
            Obligation.due_date <= cutoff,
        )
        .order_by(Obligation.due_date.asc())
        .all()
    )

    now = datetime.utcnow()
    result = []
    for o in rows:
        days = int((o.due_date - now).total_seconds() // 86400) if o.due_date else None
        result.append(
            ObligationOut(
                id=o.id,
                contract_id=o.contract_id,
                type=o.type,
                due_date=o.due_date,
                notice_days=o.notice_days,
                status=o.status,
                days_until_due=days,
            )
        )
    return result


@router.post("/", response_model=ObligationOut)
def create_obligation(
    payload: ObligationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually create an obligation/reminder for one of the user's contracts."""
    contract = db.get(Contract, payload.contract_id)
    if not contract or contract.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Contract not found")

    obligation = Obligation(
        contract_id=payload.contract_id,
        type=payload.type,
        due_date=payload.due_date,
        notice_days=payload.notice_days,
        status="pending",
    )
    db.add(obligation)
    db.commit()
    db.refresh(obligation)

    now = datetime.utcnow()
    days = int((obligation.due_date - now).total_seconds() // 86400) if obligation.due_date else None
    return ObligationOut(
        id=obligation.id,
        contract_id=obligation.contract_id,
        type=obligation.type,
        due_date=obligation.due_date,
        notice_days=obligation.notice_days,
        status=obligation.status,
        days_until_due=days,
    )


@router.patch("/{obligation_id}/dismiss")
def dismiss_obligation(
    obligation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obligation = db.get(Obligation, obligation_id)
    if not obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")

    contract = db.get(Contract, obligation.contract_id)
    if not contract or contract.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    obligation.status = "dismissed"
    db.commit()
    return {"id": str(obligation_id), "status": "dismissed"}
