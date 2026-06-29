import uuid

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.core.db import Base


class BillingSubscription(Base):
    """Tech-co ledger."""

    __tablename__ = "billing_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")
