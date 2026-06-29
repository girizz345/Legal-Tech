import uuid

from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.db import Base


class Template(Base):
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    schema_json = Column(JSONB, nullable=False, default=dict)
    body = Column(Text, nullable=False, default="")
