import uuid
from typing import Any

from pydantic import BaseModel

from app.modules.ai_orchestration.schemas import SectionDraft


class GenerateDocumentRequest(BaseModel):
    template_id: uuid.UUID
    answers: dict[str, Any]


class UpdateAnswersRequest(BaseModel):
    answers: dict[str, Any]


class GenerateDocumentResponse(BaseModel):
    contract_id: uuid.UUID
    status: str
    sections: list[SectionDraft]


class ContractDetailResponse(BaseModel):
    contract_id: uuid.UUID
    template_id: uuid.UUID
    status: str
    answers: dict[str, Any]
    sections: list[SectionDraft]
