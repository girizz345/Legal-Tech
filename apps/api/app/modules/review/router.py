"""Reviews — the bridge between users and the law firm.

State machine:
  requested → assigned (admin assigns an advocate)
  assigned  → in_review (advocate starts)
  in_review → returned  (advocate returns with a note/markup)
  returned  → closed    (user acknowledges)

Ring-fence rule: every Review is tied to a firm Entity. LegalFee entries for
that review go on the firm ledger only — never into tech-co revenue.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.db import get_db
from app.core.storage import upload_bytes
from app.models.entity import Entity, EntityKind
from app.models.review import LegalFee, Review, ReviewArtifact, ReviewArtifactKind, ReviewState
from app.models.user import User, UserRole
from app.modules.auth.dependencies import get_current_user, require_role

router = APIRouter()

# Valid state transitions
_TRANSITIONS: dict[ReviewState, set[ReviewState]] = {
    ReviewState.requested: {ReviewState.assigned},
    ReviewState.assigned:  {ReviewState.in_review},
    ReviewState.in_review: {ReviewState.returned},
    ReviewState.returned:  {ReviewState.closed},
}

# Who may trigger each target state
_STATE_ROLES: dict[ReviewState, set[UserRole]] = {
    ReviewState.assigned:  {UserRole.admin},
    ReviewState.in_review: {UserRole.advocate, UserRole.admin},
    ReviewState.returned:  {UserRole.advocate, UserRole.admin},
    ReviewState.closed:    {UserRole.user,     UserRole.admin},
}


def _firm_entity(db: Session) -> Entity:
    firm = db.query(Entity).filter(Entity.kind == EntityKind.firm).first()
    if not firm:
        raise HTTPException(
            status_code=400,
            detail=(
                "No law firm entity found. An admin must create a firm entity "
                "at POST /entities/ before review requests can be submitted."
            ),
        )
    return firm


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReviewCreateRequest(BaseModel):
    contract_id: Optional[uuid.UUID] = None


class ReviewOut(BaseModel):
    id: uuid.UUID
    contract_id: Optional[uuid.UUID] = None
    user_id: uuid.UUID
    advocate_id: Optional[uuid.UUID] = None
    entity_id: uuid.UUID
    state: ReviewState
    requested_at: datetime
    returned_at: Optional[datetime] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


class AssignRequest(BaseModel):
    advocate_id: uuid.UUID


class StateRequest(BaseModel):
    state: ReviewState
    note: Optional[str] = None


class ArtifactOut(BaseModel):
    id: uuid.UUID
    review_id: uuid.UUID
    entity_id: uuid.UUID
    file_key: Optional[str] = None
    content: Optional[str] = None
    kind: ReviewArtifactKind

    class Config:
        from_attributes = True


class FeeCreateRequest(BaseModel):
    amount: float


class FeeOut(BaseModel):
    id: uuid.UUID
    review_id: uuid.UUID
    entity_id: uuid.UUID
    amount: float
    status: str

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=ReviewOut)
def create_review(
    payload: ReviewCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    firm = _firm_entity(db)
    review = Review(
        contract_id=payload.contract_id,
        user_id=current_user.id,
        entity_id=firm.id,
        state=ReviewState.requested,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    write_audit(db, current_user.id, "review.create", target=str(review.id))
    return review


@router.get("/", response_model=list[ReviewOut])
def list_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Review)
    if current_user.role == UserRole.user:
        q = q.filter(Review.user_id == current_user.id)
    elif current_user.role == UserRole.advocate:
        q = q.filter(Review.advocate_id == current_user.id)
    # admin sees everything
    return q.order_by(Review.requested_at.desc()).all()


@router.get("/{review_id}", response_model=ReviewOut)
def get_review(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if current_user.role == UserRole.user and review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == UserRole.advocate and review.advocate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return review


@router.patch("/{review_id}/assign", response_model=ReviewOut)
def assign_review(
    review_id: uuid.UUID,
    payload: AssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.state != ReviewState.requested:
        raise HTTPException(
            status_code=400,
            detail=f"Can only assign reviews in 'requested' state (current: '{review.state}')",
        )
    advocate = db.get(User, payload.advocate_id)
    if not advocate or advocate.role != UserRole.advocate:
        raise HTTPException(status_code=400, detail="Target user is not an advocate")

    review.advocate_id = payload.advocate_id
    review.state = ReviewState.assigned
    db.commit()
    db.refresh(review)
    write_audit(db, current_user.id, "review.assign", target=str(review.id))
    return review


@router.patch("/{review_id}/state", response_model=ReviewOut)
def update_review_state(
    review_id: uuid.UUID,
    payload: StateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    allowed_next = _TRANSITIONS.get(review.state, set())
    if payload.state not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition '{review.state}' → '{payload.state}'",
        )

    if current_user.role not in _STATE_ROLES.get(payload.state, set()):
        raise HTTPException(status_code=403, detail="Your role cannot perform this state change")

    if payload.state == ReviewState.closed and current_user.role == UserRole.user:
        if review.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your review")

    if current_user.role == UserRole.advocate and review.advocate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to you")

    review.state = payload.state
    if payload.note is not None:
        review.note = payload.note
    if payload.state == ReviewState.returned:
        review.returned_at = datetime.utcnow()

    db.commit()
    db.refresh(review)
    write_audit(db, current_user.id, f"review.state.{payload.state}", target=str(review.id))
    return review


@router.post("/{review_id}/artifacts", response_model=ArtifactOut)
async def upload_artifact(
    review_id: uuid.UUID,
    kind: ReviewArtifactKind = Form(...),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.advocate, UserRole.admin)),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if current_user.role == UserRole.advocate and review.advocate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to you")

    file_key = None
    if file and file.filename:
        data = await file.read()
        file_key = f"reviews/{review_id}/artifacts/{uuid.uuid4()}/{file.filename}"
        upload_bytes(file_key, data, content_type=file.content_type or "application/octet-stream")

    artifact = ReviewArtifact(
        review_id=review_id,
        entity_id=review.entity_id,
        file_key=file_key,
        content=content,
        kind=kind,
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    write_audit(db, current_user.id, "review.artifact.upload", target=str(review_id))
    return artifact


@router.get("/{review_id}/artifacts", response_model=list[ArtifactOut])
def list_artifacts(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return db.query(ReviewArtifact).filter(ReviewArtifact.review_id == review_id).all()


@router.post("/{review_id}/fees", response_model=FeeOut)
def create_fee(
    review_id: uuid.UUID,
    payload: FeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    fee = LegalFee(
        review_id=review_id,
        entity_id=review.entity_id,
        amount=payload.amount,
        status="pending",
    )
    db.add(fee)
    db.commit()
    db.refresh(fee)
    write_audit(db, current_user.id, "review.fee.create", target=str(review_id))
    return fee
