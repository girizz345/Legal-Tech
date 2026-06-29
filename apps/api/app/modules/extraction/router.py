"""Extraction — wires Irene's extract_terms() into the backend.
Girish stores the returned fields in contract_terms with confidence scores;
Irene's implementation replaces the body of extract_terms() in core/ai_contract.py.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.ai_contract import extract_terms
from app.core.db import get_db
from app.models.contract import Contract, ContractTerm
from app.models.user import User, UserRole
from app.modules.auth.dependencies import get_current_user

router = APIRouter()


class TermOut(BaseModel):
    key: str
    value: Optional[str] = None
    confidence: float


class ExtractionResult(BaseModel):
    contract_id: uuid.UUID
    terms: list[TermOut]
    ocr_excerpt: str


@router.post("/{contract_id}/extract", response_model=ExtractionResult)
def run_extraction(
    contract_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run term extraction for an uploaded contract (idempotent)."""
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.user_id != current_user.id and current_user.role not in (UserRole.advocate, UserRole.admin):
        raise HTTPException(status_code=403, detail="Not authorized")

    ocr_row = (
        db.query(ContractTerm)
        .filter(ContractTerm.contract_id == contract_id, ContractTerm.key == "ocr_text")
        .first()
    )
    ocr_text = ocr_row.value if ocr_row else ""
    if not ocr_text:
        raise HTTPException(
            status_code=400,
            detail="No OCR text found for this contract. Upload the file first via POST /uploads/contract.",
        )

    result = extract_terms(ocr_text)

    # Replace existing term: fields (idempotent)
    db.query(ContractTerm).filter(
        ContractTerm.contract_id == contract_id,
        ContractTerm.key.like("term:%"),
    ).delete(synchronize_session=False)

    for f in result.fields:
        db.add(ContractTerm(
            contract_id=contract_id,
            key=f"term:{f.key}",
            value=f.value,
            confidence=f.confidence,
        ))
    db.commit()

    return ExtractionResult(
        contract_id=contract_id,
        terms=[TermOut(key=f.key, value=f.value, confidence=f.confidence) for f in result.fields],
        ocr_excerpt=result.raw_text_excerpt,
    )


@router.get("/{contract_id}/terms", response_model=list[TermOut])
def get_terms(
    contract_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.user_id != current_user.id and current_user.role not in (UserRole.advocate, UserRole.admin):
        raise HTTPException(status_code=403, detail="Not authorized")

    rows = (
        db.query(ContractTerm)
        .filter(ContractTerm.contract_id == contract_id, ContractTerm.key.like("term:%"))
        .all()
    )
    return [
        TermOut(key=r.key.removeprefix("term:"), value=r.value, confidence=r.confidence or 0.0)
        for r in rows
    ]
