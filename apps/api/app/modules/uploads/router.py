"""Uploads — file ingestion, OCR, and term extraction for uploaded contracts."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.ai_contract import ExtractedTerms, extract_terms
from app.core.db import get_db
from app.core.storage import upload_bytes
from app.models.contract import Contract, ContractSource, ContractTerm
from app.models.upload import Upload, UploadStatus
from app.models.user import User
from app.modules.auth.dependencies import get_current_user
from app.modules.uploads.ocr import extract_text

router = APIRouter()

_MAX_BYTES = 20 * 1024 * 1024  # 20 MB
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


class ExtractedTermOut(BaseModel):
    key: str
    value: Optional[str] = None
    confidence: float


class UploadOut(BaseModel):
    upload_id: uuid.UUID
    contract_id: uuid.UUID
    status: str
    filename: str
    ocr_excerpt: str
    extracted_terms: list[ExtractedTermOut]


@router.post("/contract", response_model=UploadOut)
async def upload_contract(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename = file.filename or "unnamed"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")

    # Store raw file to MinIO
    file_key = f"uploads/{current_user.id}/{uuid.uuid4()}/{filename}"
    upload_bytes(file_key, data, content_type=file.content_type or "application/octet-stream")

    # Create upload record (status=processing)
    upload = Upload(
        user_id=current_user.id,
        file_key=file_key,
        filename=filename,
        status=UploadStatus.processing,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    try:
        ocr_text = extract_text(data, filename)
        terms_result: ExtractedTerms = extract_terms(ocr_text)

        # Create Contract record for the uploaded file
        contract = Contract(
            user_id=current_user.id,
            source=ContractSource.uploaded,
            file_key=file_key,
            status="uploaded",
        )
        db.add(contract)
        db.commit()
        db.refresh(contract)

        # Persist OCR text (truncated) and extracted terms in contract_terms
        db.add(ContractTerm(
            contract_id=contract.id,
            key="ocr_text",
            value=ocr_text[:50_000],
            confidence=1.0,
        ))
        for f in terms_result.fields:
            db.add(ContractTerm(
                contract_id=contract.id,
                key=f"term:{f.key}",
                value=f.value,
                confidence=f.confidence,
            ))
        db.commit()

        # Finalise upload record
        upload.contract_id = contract.id
        upload.ocr_text = ocr_text[:5_000]
        upload.status = UploadStatus.done
        db.commit()

    except Exception as exc:
        upload.status = UploadStatus.failed
        upload.error = str(exc)[:500]
        db.commit()
        raise HTTPException(status_code=500, detail="OCR/extraction failed. Check upload status.")

    return UploadOut(
        upload_id=upload.id,
        contract_id=contract.id,
        status=upload.status.value,
        filename=filename,
        ocr_excerpt=terms_result.raw_text_excerpt,
        extracted_terms=[
            ExtractedTermOut(key=f.key, value=f.value, confidence=f.confidence)
            for f in terms_result.fields
        ],
    )


@router.get("/{upload_id}", response_model=UploadOut)
def get_upload(
    upload_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = db.get(Upload, upload_id)
    if not upload or upload.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Upload not found")

    terms: list[ContractTerm] = []
    if upload.contract_id:
        terms = (
            db.query(ContractTerm)
            .filter(
                ContractTerm.contract_id == upload.contract_id,
                ContractTerm.key.like("term:%"),
            )
            .all()
        )

    return UploadOut(
        upload_id=upload.id,
        contract_id=upload.contract_id or uuid.UUID(int=0),
        status=upload.status.value,
        filename=upload.filename,
        ocr_excerpt=(upload.ocr_text or "")[:500],
        extracted_terms=[
            ExtractedTermOut(
                key=t.key.removeprefix("term:"),
                value=t.value,
                confidence=t.confidence or 0.0,
            )
            for t in terms
        ],
    )
