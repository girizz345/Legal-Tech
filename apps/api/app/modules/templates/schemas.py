import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict


class TemplateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    name: str
    version: int


class TemplateDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    name: str
    version: int
    schema_json: dict[str, Any]
