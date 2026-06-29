import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.db import Base


class ContractSource(str, enum.Enum):
    generated = "generated"
    uploaded = "uploaded"


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    source = Column(Enum(ContractSource, name="contract_source"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id"), nullable=True)
    answers_json = Column(JSONB, nullable=True)
    file_key = Column(String, nullable=True)
    status = Column(String, nullable=False, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ContractTerm(Base):
    __tablename__ = "contract_terms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    key = Column(String, nullable=False)
    value = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)


class Obligation(Base):
    __tablename__ = "obligations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    type = Column(String, nullable=False)
    due_date = Column(DateTime, nullable=True)
    notice_days = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="pending")
