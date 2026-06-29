import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.llm import get_llm_client
from app.core.storage import upload_bytes
from app.models.contract import Contract, ContractSource, ContractTerm
from app.models.template import Template
from app.models.user import User, UserRole
from app.modules.ai_orchestration.schemas import SectionDraft
from app.modules.ai_orchestration.service import assemble_draft, render_template_string
from app.modules.auth.dependencies import get_current_user
from app.modules.documents.render import render_docx, render_pdf
from app.modules.documents.schemas import (
    ContractDetailResponse,
    GenerateDocumentRequest,
    GenerateDocumentResponse,
    UpdateAnswersRequest,
)
from app.modules.documents.validation import AnswerValidationError, validate_answers

router = APIRouter()


class ContractSummary(BaseModel):
    contract_id: uuid.UUID
    source: str
    status: str
    template_id: Optional[uuid.UUID]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ContractSummary])
def list_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contracts = (
        db.query(Contract)
        .filter(Contract.user_id == current_user.id)
        .order_by(Contract.created_at.desc())
        .all()
    )
    return [
        ContractSummary(
            contract_id=c.id,
            source=c.source.value,
            status=c.status,
            template_id=c.template_id,
            created_at=c.created_at,
        )
        for c in contracts
    ]


def _persist_sections(db: Session, contract_id: uuid.UUID, sections: list[SectionDraft]) -> None:
    db.query(ContractTerm).filter(
        ContractTerm.contract_id == contract_id,
        ContractTerm.key.like("section:%"),
    ).delete()
    for section in sections:
        db.add(
            ContractTerm(
                contract_id=contract_id,
                key=f"section:{section.section_id}",
                value=section.variant_id,
                confidence=section.classifier_score,
            )
        )
    db.commit()


@router.post("/generate", response_model=GenerateDocumentResponse)
def generate_document(
    payload: GenerateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = db.get(Template, payload.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        validate_answers(template.schema_json, payload.answers)
    except AnswerValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    contract = Contract(
        user_id=current_user.id,
        source=ContractSource.generated,
        status="draft",
        template_id=template.id,
        answers_json=payload.answers,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    result = assemble_draft(db, template, payload.answers, current_user, contract.id, get_llm_client())
    _persist_sections(db, contract.id, result.sections)

    return GenerateDocumentResponse(contract_id=contract.id, status=contract.status, sections=result.sections)


@router.put("/{contract_id}/answers", response_model=GenerateDocumentResponse)
def update_answers(
    contract_id: uuid.UUID,
    payload: UpdateAnswersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract or contract.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Contract not found")

    template = db.get(Template, contract.template_id)
    try:
        validate_answers(template.schema_json, payload.answers)
    except AnswerValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    contract.answers_json = payload.answers
    db.commit()

    result = assemble_draft(db, template, payload.answers, current_user, contract.id, get_llm_client())
    _persist_sections(db, contract.id, result.sections)

    return GenerateDocumentResponse(contract_id=contract.id, status=contract.status, sections=result.sections)


@router.get("/{contract_id}", response_model=ContractDetailResponse)
def get_document(
    contract_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.user_id != current_user.id and current_user.role not in (UserRole.advocate, UserRole.admin):
        raise HTTPException(status_code=403, detail="Not authorized to access this contract")

    template = db.get(Template, contract.template_id)
    sections = _reload_sections(db, contract, template)
    return ContractDetailResponse(
        contract_id=contract.id,
        template_id=contract.template_id,
        status=contract.status,
        answers=contract.answers_json or {},
        sections=sections,
    )


def _reload_sections(db: Session, contract: Contract, template: Template) -> list[SectionDraft]:
    terms = {
        term.key.removeprefix("section:"): term
        for term in db.query(ContractTerm).filter(
            ContractTerm.contract_id == contract.id,
            ContractTerm.key.like("section:%"),
        )
    }
    answers = contract.answers_json or {}
    sections_out = []
    for section in template.schema_json["sections"]:
        term = terms.get(section["id"])
        if term is None:
            continue
        variant = section["variants"][term.value]
        sections_out.append(
            SectionDraft(
                section_id=section["id"],
                title=section["title"],
                variant_id=term.value,
                resolution=section["resolution"],
                body_text=render_template_string(variant.get("body_template", ""), answers),
                note_text=render_template_string(variant.get("plain_note_template", ""), answers),
                classifier_score=term.confidence or 0.0,
            )
        )
    return sections_out


@router.get("/{contract_id}/download")
def download_document(
    contract_id: uuid.UUID,
    format: Literal["pdf", "docx"],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.user_id != current_user.id and current_user.role not in (UserRole.advocate, UserRole.admin):
        raise HTTPException(status_code=403, detail="Not authorized to access this contract")

    template = db.get(Template, contract.template_id)
    sections = _reload_sections(db, contract, template)

    if format == "pdf":
        data = render_pdf(template.name, sections)
        content_type = "application/pdf"
    else:
        data = render_docx(template.name, sections)
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    key = f"contracts/{contract.id}/document.{format}"
    upload_bytes(key, data, content_type=content_type)
    contract.file_key = key
    contract.status = "generated"
    db.commit()

    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="contract.{format}"'},
    )
