"""Billing — two completely separate ledgers.

Tech-co ledger : billing_subscriptions  (subscription revenue, owned by tech co)
Firm ledger    : legal_fees             (review fees, owned by the law firm)

These ledgers NEVER roll up together. Two-sided settlement (Razorpay Route or
equivalent) will route each stream to the correct bank account at settlement time.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.billing import BillingSubscription
from app.models.review import LegalFee
from app.models.user import User, UserRole
from app.modules.auth.dependencies import get_current_user, require_role

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SubscriptionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    plan: str
    status: str

    class Config:
        from_attributes = True


class SubscriptionCreateRequest(BaseModel):
    user_id: uuid.UUID
    plan: str


class SubscriptionUpdateRequest(BaseModel):
    status: str


class LegalFeeOut(BaseModel):
    id: uuid.UUID
    review_id: uuid.UUID
    entity_id: uuid.UUID
    amount: float
    status: str

    class Config:
        from_attributes = True


# ── Tech-co ledger ────────────────────────────────────────────────────────────

@router.get("/subscriptions/", response_model=list[SubscriptionOut])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(BillingSubscription)
    if current_user.role == UserRole.user:
        q = q.filter(BillingSubscription.user_id == current_user.id)
    # advocate/admin see all
    return q.all()


@router.post("/subscriptions/", response_model=SubscriptionOut)
def create_subscription(
    payload: SubscriptionCreateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.admin)),
):
    sub = BillingSubscription(user_id=payload.user_id, plan=payload.plan)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.patch("/subscriptions/{sub_id}", response_model=SubscriptionOut)
def update_subscription(
    sub_id: uuid.UUID,
    payload: SubscriptionUpdateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.admin)),
):
    sub = db.get(BillingSubscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = payload.status
    db.commit()
    db.refresh(sub)
    return sub


# ── Firm ledger ───────────────────────────────────────────────────────────────

@router.get("/fees/", response_model=list[LegalFeeOut])
def list_fees(
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.advocate, UserRole.admin)),
):
    """Firm ledger — advocate and admin only. Never exposed to end users."""
    return db.query(LegalFee).all()


@router.patch("/fees/{fee_id}/settle")
def settle_fee(
    fee_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.admin)),
):
    fee = db.get(LegalFee, fee_id)
    if not fee:
        raise HTTPException(status_code=404, detail="Fee not found")
    fee.status = "settled"
    db.commit()
    return {"id": str(fee_id), "status": "settled"}
