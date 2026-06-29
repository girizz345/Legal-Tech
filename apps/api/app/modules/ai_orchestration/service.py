import uuid
from typing import Any

from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.llm import LLMClient
from app.models.ai_event import AIEvent
from app.models.template import Template
from app.models.user import User
from app.modules.ai_orchestration.schemas import AssembleDraftResult, SectionDraft

_jinja_env = SandboxedEnvironment(autoescape=False)


def render_template_string(template_str: str, answers: dict[str, Any]) -> str:
    if not template_str:
        return ""
    return _jinja_env.from_string(template_str).render(**answers).strip()


def _resolve_deterministic(section: dict[str, Any], answers: dict[str, Any]) -> tuple[str, float]:
    field_value = answers.get(section["condition_field"])
    if field_value in section["variants"]:
        return field_value, 1.0
    return section["default_variant_id"], 1.0


def _resolve_static(section: dict[str, Any]) -> tuple[str, float]:
    return section["default_variant_id"], 1.0


def _resolve_llm_classify(
    section: dict[str, Any], answers: dict[str, Any], llm_client: LLMClient
) -> tuple[str, float]:
    source_value = answers.get(section["source_field"])
    if not source_value:
        return section["default_variant_id"], 0.0

    variants = section["variants"]
    descriptions = {vid: variant.get("plain_note_template", vid) for vid, variant in variants.items()}
    choice = llm_client.classify_variant(
        section_title=section["title"],
        allowed_variant_ids=list(variants.keys()),
        variant_descriptions=descriptions,
        user_input=str(source_value),
    )
    if choice is None or choice.variant_id not in variants:
        return section["default_variant_id"], 0.0
    return choice.variant_id, choice.confidence


def assemble_draft(
    db: Session,
    template: Template,
    answers: dict[str, Any],
    user: User,
    contract_id: uuid.UUID | None,
    llm_client: LLMClient,
) -> AssembleDraftResult:
    sections_out: list[SectionDraft] = []

    for section in template.schema_json["sections"]:
        resolution = section["resolution"]
        if resolution == "deterministic":
            variant_id, score = _resolve_deterministic(section, answers)
        elif resolution == "static":
            variant_id, score = _resolve_static(section)
        else:
            variant_id, score = _resolve_llm_classify(section, answers, llm_client)

        variant = section["variants"][variant_id]
        body_text = render_template_string(variant.get("body_template", ""), answers)
        note_text = render_template_string(variant.get("plain_note_template", ""), answers)
        if not note_text and resolution == "llm_classify":
            note_text = llm_client.generate_note(
                section_title=section["title"],
                chosen_variant_id=variant_id,
                user_input=str(answers.get(section.get("source_field", ""), "")),
            )

        sections_out.append(
            SectionDraft(
                section_id=section["id"],
                title=section["title"],
                variant_id=variant_id,
                resolution=resolution,
                body_text=body_text,
                note_text=note_text,
                classifier_score=score,
            )
        )

        db.add(
            AIEvent(
                user_id=user.id,
                contract_id=contract_id,
                kind=f"generate:{section['id']}",
                routed_to_human=False,
                classifier_score=score,
                model=settings.anthropic_model if resolution == "llm_classify" else None,
            )
        )

    db.commit()
    return AssembleDraftResult(sections=sections_out)
