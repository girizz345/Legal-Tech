from typing import Any


class AnswerValidationError(ValueError):
    pass


def validate_answers(schema_json: dict[str, Any], answers: dict[str, Any]) -> None:
    """Server-side enforcement that answers conform to the template's structured
    field schema — the boundary an API call can't bypass even if the frontend's
    dynamic form were skipped entirely."""
    for field in schema_json.get("fields", []):
        field_id = field["id"]
        value = answers.get(field_id)

        if field.get("required") and (value is None or value == ""):
            raise AnswerValidationError(f"'{field_id}' is required")

        if value is None or value == "":
            continue

        field_type = field["type"]
        if field_type == "select":
            options = field.get("options", [])
            if value not in options:
                raise AnswerValidationError(f"'{field_id}' must be one of {options}")
        elif field_type == "number":
            try:
                num = float(value)
            except (TypeError, ValueError):
                raise AnswerValidationError(f"'{field_id}' must be a number")
            if "min" in field and num < field["min"]:
                raise AnswerValidationError(f"'{field_id}' must be >= {field['min']}")
            if "max" in field and num > field["max"]:
                raise AnswerValidationError(f"'{field_id}' must be <= {field['max']}")
        elif field_type == "text":
            max_length = field.get("max_length")
            if max_length is not None and len(str(value)) > max_length:
                raise AnswerValidationError(f"'{field_id}' exceeds max_length {max_length}")
        elif field_type == "date":
            if not isinstance(value, str):
                raise AnswerValidationError(f"'{field_id}' must be a date string")
