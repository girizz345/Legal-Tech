import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID

from app.core.db import Base


class EntityKind(str, enum.Enum):
    tech_co = "tech_co"
    firm = "firm"


class Entity(Base):
    __tablename__ = "entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    kind = Column(Enum(EntityKind, name="entity_kind"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
