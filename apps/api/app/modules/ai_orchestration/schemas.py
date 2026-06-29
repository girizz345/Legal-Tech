import uuid
from typing import Any

from pydantic import BaseModel


class SectionDraft(BaseModel):
    section_id: str
    title: str
    variant_id: str
    resolution: str
    body_text: str
    note_text: str
    classifier_score: float


class AssembleDraftResult(BaseModel):
    sections: list[SectionDraft]


class AssembleDraftRequest(BaseModel):
    template_id: uuid.UUID
    answers: dict[str, Any]
