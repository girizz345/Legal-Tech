"""AI Orchestration — internal assembly and the explain-clause endpoint.

classify_query() is called here before explain_clause() so that queries
asking for legal advice are routed to a human, not answered by the AI.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.ai_contract import classify_query, explain_clause
from app.core.db import get_db
from app.core.llm import get_llm_client
from app.models.template import Template
from app.models.user import User
from app.modules.ai_orchestration.schemas import AssembleDraftRequest, AssembleDraftResult
from app.modules.ai_orchestration.service import assemble_draft
from app.modules.auth.dependencies import get_current_user

router = APIRouter()


class ExplainRequest(BaseModel):
    question: str
    contract_id: Optional[uuid.UUID] = None
    clause_text: Optional[str] = None


class ExplainResponse(BaseModel):
    decision: str          # "answer" | "route_to_advocate"
    confidence: float
    answer: Optional[str] = None          # present when decision=="answer"
    source_clause: Optional[str] = None  # present when decision=="answer"
    route_reason: Optional[str] = None   # present when decision=="route_to_advocate"


@router.post("/explain", response_model=ExplainResponse)
def explain_endpoint(
    payload: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Step 1 — classify the query.
    Step 2 — if decision=="answer", call explain_clause().
             if decision=="route_to_advocate", return routing signal (no AI answer).

    The frontend must check `decision` before rendering — if "route_to_advocate",
    it should surface the review-request UI, not show the answer field.
    """
    classification = classify_query(
        db,
        user_id=current_user.id,
        query_text=payload.question,
        contract_id=payload.contract_id,
    )

    if classification.decision == "route_to_advocate":
        return ExplainResponse(
            decision="route_to_advocate",
            confidence=classification.confidence,
            route_reason=classification.reason,
        )

    explanation = explain_clause(
        db,
        user_id=current_user.id,
        question=payload.question,
        contract_id=payload.contract_id,
        clause_text=payload.clause_text,
    )

    return ExplainResponse(
        decision="answer",
        confidence=classification.confidence,
        answer=explanation.answer,
        source_clause=explanation.source_clause,
    )


@router.post("/internal/assemble-draft", response_model=AssembleDraftResult)
def assemble_draft_endpoint(
    payload: AssembleDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exercises ai_orchestration in isolation, without creating a Contract.
    The real caller is documents.router, which calls assemble_draft() directly."""
    template = db.get(Template, payload.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return assemble_draft(db, template, payload.answers, current_user, None, get_llm_client())
