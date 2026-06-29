from pathlib import Path
from typing import Any

import yaml

from app.core.db import SessionLocal
from app.models.template import Template

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data" / "templates"

ALLOWED_FIELD_TYPES = {"text", "select", "date", "number"}
ALLOWED_RESOLUTIONS = {"deterministic", "static", "llm_classify"}


class TemplateValidationError(ValueError):
    pass


def validate_template_schema(data: dict[str, Any]) -> None:
    key = data.get("key")
    if not key or not isinstance(key, str):
        raise TemplateValidationError("template is missing a string 'key'")
    if "name" not in data or "version" not in data:
        raise TemplateValidationError(f"{key}: missing 'name' or 'version'")

    fields = data.get("fields") or []
    field_ids = set()
    for field in fields:
        field_id = field.get("id")
        if not field_id:
            raise TemplateValidationError(f"{key}: a field is missing 'id'")
        field_ids.add(field_id)

        field_type = field.get("type")
        if field_type not in ALLOWED_FIELD_TYPES:
            raise TemplateValidationError(
                f"{key}.{field_id}: type '{field_type}' is not one of {ALLOWED_FIELD_TYPES} "
                "(no open-ended free-text field type is allowed)"
            )
        if field_type == "select" and not field.get("options"):
            raise TemplateValidationError(f"{key}.{field_id}: type 'select' requires non-empty 'options'")

    sections = data.get("sections") or []
    if not sections:
        raise TemplateValidationError(f"{key}: template has no sections")

    for section in sections:
        section_id = section.get("id")
        resolution = section.get("resolution")
        if resolution not in ALLOWED_RESOLUTIONS:
            raise TemplateValidationError(
                f"{key}.{section_id}: resolution '{resolution}' is not one of {ALLOWED_RESOLUTIONS}"
            )

        variants = section.get("variants") or {}
        if not variants:
            raise TemplateValidationError(f"{key}.{section_id}: section has no variants")

        default_variant_id = section.get("default_variant_id")
        if default_variant_id not in variants:
            raise TemplateValidationError(
                f"{key}.{section_id}: default_variant_id '{default_variant_id}' is not a key in variants"
            )

        if resolution == "deterministic":
            condition_field = section.get("condition_field")
            if condition_field not in field_ids:
                raise TemplateValidationError(
                    f"{key}.{section_id}: condition_field '{condition_field}' is not a defined field"
                )

        if resolution == "llm_classify":
            source_field = section.get("source_field")
            matching = next((f for f in fields if f.get("id") == source_field), None)
            if matching is None:
                raise TemplateValidationError(
                    f"{key}.{section_id}: source_field '{source_field}' is not a defined field"
                )
            if matching.get("type") != "text":
                raise TemplateValidationError(
                    f"{key}.{section_id}: source_field '{source_field}' must be type 'text'"
                )


def load_seed_files() -> list[dict[str, Any]]:
    templates = []
    for path in sorted(SEED_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        validate_template_schema(data)
        templates.append(data)
    return templates


def seed() -> None:
    db = SessionLocal()
    try:
        for data in load_seed_files():
            existing = db.query(Template).filter_by(key=data["key"]).one_or_none()
            if existing and existing.version >= data["version"]:
                continue
            if existing:
                existing.name = data["name"]
                existing.version = data["version"]
                existing.schema_json = data
            else:
                db.add(
                    Template(
                        key=data["key"],
                        name=data["name"],
                        version=data["version"],
                        schema_json=data,
                        body="",
                    )
                )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Templates seeded.")
