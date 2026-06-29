"""
AI Contract — the four shared functions that define the boundary between
Girish's backend wiring (caller) and Irene's AI/LLM implementations (owner).

Irene replaces each function body; the signatures and return types are frozen.
Girish calls these functions and persists/routes their output — he never
generates contract text or AI responses directly.

HOW TO HAND OFF:
  • Replace the function body only.
  • Never change the signature, parameter names, or return types.
  • Never raise exceptions from inside these functions — return None or the
    default dataclass on any internal failure so the caller can degrade gracefully.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.ai_event import AIEvent


# ── Return types (frozen — agree with Irene before changing) ─────────────────

@dataclass
class QueryClassification:
    decision: str        # "answer" | "route_to_advocate"
    confidence: float    # 0.0–1.0
    reason: str          # Human-readable; shown only in ai_events, not to end-user


@dataclass
class ExtractedField:
    key: str
    value: Optional[str]
    confidence: float    # 0.0–1.0


@dataclass
class ExtractedTerms:
    fields: list[ExtractedField]
    raw_text_excerpt: str    # First 500 chars of OCR/extracted text for UI preview


@dataclass
class ClauseExplanation:
    answer: str
    source_clause: Optional[str]    # Verbatim clause text the answer cites, if found


# ── 1. classify_query ─────────────────────────────────────────────────────────
# Must be called before EVERY AI-facing endpoint. If decision=="route_to_advocate",
# the caller must NOT surface any AI-generated answer — surface the review-request UI.

_ADVOCATE_KEYWORDS = frozenset({
    "court", "lawsuit", "sue", "sued", "criminal", "illegal", "fraud",
    "complaint", "jurisdiction", "verdict", "judgment", "injunction",
    "enforcement", "my rights", "take to court", "file a case",
    "police", "arrest", "fir", "contempt", "prosecution", "offence",
    "arbitration award", "enforce award", "writ", "high court", "supreme court",
})


def classify_query(
    db: Session,
    user_id: uuid.UUID,
    query_text: str,
    contract_id: Optional[uuid.UUID] = None,
) -> QueryClassification:
    """
    STUB — Irene replaces the body with a real classifier.
    Keyword denylist is the stub; Irene's version uses a fine-tuned classifier
    with adversarial test coverage.
    """
    lowered = query_text.lower()
    matched = [kw for kw in _ADVOCATE_KEYWORDS if kw in lowered]

    if matched:
        decision = "route_to_advocate"
        confidence = min(0.5 + 0.1 * len(matched), 0.95)
        reason = f"Denylist keywords matched: {', '.join(matched[:5])}"
    else:
        decision = "answer"
        confidence = 0.75
        reason = "No denylist keywords matched (stub)"

    routed = decision == "route_to_advocate"
    db.add(AIEvent(
        user_id=user_id,
        contract_id=contract_id,
        kind="query_classify",
        routed_to_human=routed,
        classifier_score=confidence,
        model="stub_keyword_v1",
    ))
    db.commit()

    return QueryClassification(decision=decision, confidence=confidence, reason=reason)


# ── 2. extract_terms ──────────────────────────────────────────────────────────
# Irene replaces with an LLM-powered named-entity extractor.

_DATE_RE = re.compile(
    r"\b(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|"
    r"(?:January|February|March|April|May|June|July|August|"
    r"September|October|November|December)\s+\d{1,2},?\s+\d{4})\b",
    re.IGNORECASE,
)
_MONEY_RE = re.compile(r"(?:INR|Rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?", re.IGNORECASE)
_PARTY_RE = re.compile(
    r"(?:between|by and between)\s+(.+?)\s+(?:and|,)\s+(.+?)(?:\.|\n|$)",
    re.IGNORECASE | re.DOTALL,
)
_NOTICE_RE = re.compile(r"(\d+)\s*(?:days?|months?)\s*(?:written\s*)?notice", re.IGNORECASE)


def extract_terms(ocr_text: str) -> ExtractedTerms:
    """
    STUB — Irene replaces the body.

    Input : raw text from OCR or PDF extraction (may be messy).
    Output: list of ExtractedField with key, value, confidence.

    Keys Girish expects (add more as Irene expands coverage):
      party_1, party_2, effective_date, expiry_date,
      contract_value, governing_law, notice_period
    """
    fields: list[ExtractedField] = []

    m = _PARTY_RE.search(ocr_text)
    if m:
        fields.append(ExtractedField("party_1", m.group(1).strip()[:200], 0.6))
        fields.append(ExtractedField("party_2", m.group(2).strip()[:200], 0.6))
    else:
        fields += [ExtractedField("party_1", None, 0.0), ExtractedField("party_2", None, 0.0)]

    dates = _DATE_RE.findall(ocr_text)
    if dates:
        fields.append(ExtractedField("effective_date", dates[0], 0.5))
        if len(dates) > 1:
            fields.append(ExtractedField("expiry_date", dates[-1], 0.4))

    money = _MONEY_RE.findall(ocr_text)
    if money:
        fields.append(ExtractedField("contract_value", money[0], 0.55))

    if re.search(r"\bindia\b|\bindian\b", ocr_text, re.IGNORECASE):
        fields.append(ExtractedField("governing_law", "India", 0.7))

    n = _NOTICE_RE.search(ocr_text)
    if n:
        fields.append(ExtractedField("notice_period", n.group(0), 0.5))

    return ExtractedTerms(fields=fields, raw_text_excerpt=ocr_text[:500])


# ── 3. explain_clause ─────────────────────────────────────────────────────────
# Irene replaces with RAG over the contract + legal knowledge base.

def explain_clause(
    db: Session,
    user_id: uuid.UUID,
    question: str,
    contract_id: Optional[uuid.UUID] = None,
    clause_text: Optional[str] = None,
) -> ClauseExplanation:
    """
    STUB — Irene replaces the body.

    CALLER RULE: Only call this if classify_query() returned decision=="answer".
    If it returned "route_to_advocate", surface the review-request UI instead.

    Input:
      question    — plain-English user question
      contract_id — Girish's code will have fetched the contract; pass the ID
                    so Irene's RAG can embed and search it
      clause_text — optional raw clause text if the caller already has it

    Output:
      answer       — plain-English explanation (no contract language)
      source_clause — verbatim clause cited, if found
    """
    db.add(AIEvent(
        user_id=user_id,
        contract_id=contract_id,
        kind="explain_clause",
        routed_to_human=False,
        classifier_score=None,
        model="stub_v1",
    ))
    db.commit()

    return ClauseExplanation(
        answer=(
            "Clause explanations are coming soon. Irene's RAG implementation will "
            "search the contract text and answer your question in plain English. "
            "For urgent questions, use the 'Request lawyer review' button."
        ),
        source_clause=clause_text,
    )


# ── 4. generate_document ─────────────────────────────────────────────────────
# Already fully implemented in app/modules/ai_orchestration/service.py.
# Listed here for documentation completeness only — not re-implemented.
