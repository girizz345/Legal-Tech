import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.core.db import Base


class ReviewState(str, enum.Enum):
    requested = "requested"
    assigned = "assigned"
    in_review = "in_review"
    returned = "returned"
    closed = "closed"


class ReviewArtifactKind(str, enum.Enum):
    markup = "markup"
    answer = "answer"


class Review(Base):
    """The bridge: ties a user's review request to the law firm entity."""

    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    advocate_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    state = Column(Enum(ReviewState, name="review_state"), nullable=False, default=ReviewState.requested)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    returned_at = Column(DateTime, nullable=True)
    note = Column(Text, nullable=True)


class ReviewArtifact(Base):
    __tablename__ = "review_artifacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(UUID(as_uuid=True), ForeignKey("reviews.id"), nullable=False)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    file_key = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    kind = Column(Enum(ReviewArtifactKind, name="review_artifact_kind"), nullable=False)


class LegalFee(Base):
    """Firm ledger. Never rolls up into tech-co revenue."""

    __tablename__ = "legal_fees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(UUID(as_uuid=True), ForeignKey("reviews.id"), nullable=False)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String, nullable=False, default="pending")
