from typing import Protocol

import anthropic
from google import genai
from google.genai import types as genai_types
from pydantic import BaseModel

from app.core.config import settings


class VariantChoice(BaseModel):
    variant_id: str
    confidence: float


class LLMClient(Protocol):
    def classify_variant(
        self,
        *,
        section_title: str,
        allowed_variant_ids: list[str],
        variant_descriptions: dict[str, str],
        user_input: str,
    ) -> VariantChoice | None: ...

    def generate_note(self, *, section_title: str, chosen_variant_id: str, user_input: str) -> str: ...


class AnthropicLLMClient:
    """Calls Anthropic's API. `classify_variant` is constrained via forced tool-use
    with an enum-typed parameter so the model can only return one of the allowed
    variant IDs — never free text that could end up in the contract body."""

    def __init__(self) -> None:
        self._client: anthropic.Anthropic | None = None

    def _get_client(self) -> anthropic.Anthropic | None:
        if not settings.anthropic_api_key:
            return None
        if self._client is None:
            self._client = anthropic.Anthropic(
                api_key=settings.anthropic_api_key,
                timeout=settings.llm_timeout_seconds,
            )
        return self._client

    def classify_variant(
        self,
        *,
        section_title: str,
        allowed_variant_ids: list[str],
        variant_descriptions: dict[str, str],
        user_input: str,
    ) -> VariantChoice | None:
        client = self._get_client()
        if client is None:
            return None

        tool = {
            "name": "select_clause_variant",
            "description": (
                "Select the single pre-approved clause variant that best matches the "
                "user's input. You must choose from the enumerated list — never invent "
                "a new variant or write contract text yourself."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "variant_id": {"type": "string", "enum": allowed_variant_ids},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["variant_id", "confidence"],
            },
        }
        descriptions_text = "\n".join(f"- {vid}: {desc}" for vid, desc in variant_descriptions.items())
        prompt = (
            f"Section: {section_title}\n"
            f"Available variants:\n{descriptions_text}\n\n"
            f"User input: {user_input!r}\n\n"
            "Pick the single closest-matching variant_id and your confidence (0-1)."
        )

        try:
            response = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=200,
                tools=[tool],
                tool_choice={"type": "tool", "name": "select_clause_variant"},
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception:
            return None

        for block in response.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "select_clause_variant":
                try:
                    return VariantChoice(**block.input)
                except Exception:
                    return None
        return None

    def generate_note(self, *, section_title: str, chosen_variant_id: str, user_input: str) -> str:
        client = self._get_client()
        if client is None:
            return ""

        prompt = (
            f"In one short plain-English sentence, explain what the '{section_title}' "
            f"section (variant: {chosen_variant_id}) means for a non-lawyer reading this "
            f"document. Do not write contract language — just explain it simply. "
            f"Context the user provided: {user_input!r}"
        )
        try:
            response = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=120,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception:
            return ""

        text_blocks = [block.text for block in response.content if getattr(block, "type", None) == "text"]
        return " ".join(text_blocks).strip()[:500]


class GeminiLLMClient:
    """Calls Google Gemini via the google-genai SDK. classify_variant is constrained
    via forced function calling (mode=ANY) with an enum-typed parameter — the model
    can only return one of the allowed variant IDs, never free contract text."""

    def _client(self) -> genai.Client | None:
        if not settings.gemini_api_key:
            return None
        return genai.Client(api_key=settings.gemini_api_key)

    def classify_variant(
        self,
        *,
        section_title: str,
        allowed_variant_ids: list[str],
        variant_descriptions: dict[str, str],
        user_input: str,
    ) -> VariantChoice | None:
        client = self._client()
        if client is None:
            return None

        tool = genai_types.Tool(
            function_declarations=[
                genai_types.FunctionDeclaration(
                    name="select_clause_variant",
                    description=(
                        "Select the single pre-approved clause variant that best matches "
                        "the user's input. You must choose from the enumerated list — "
                        "never invent a new variant or write contract text yourself."
                    ),
                    parameters=genai_types.Schema(
                        type=genai_types.Type.OBJECT,
                        properties={
                            "variant_id": genai_types.Schema(
                                type=genai_types.Type.STRING,
                                enum=allowed_variant_ids,
                                description="One of the allowed variant IDs",
                            ),
                            "confidence": genai_types.Schema(
                                type=genai_types.Type.NUMBER,
                                description="Confidence score between 0.0 and 1.0",
                            ),
                        },
                        required=["variant_id", "confidence"],
                    ),
                )
            ]
        )
        descriptions_text = "\n".join(
            f"- {vid}: {desc}" for vid, desc in variant_descriptions.items()
        )
        prompt = (
            f"Section: {section_title}\n"
            f"Available variants:\n{descriptions_text}\n\n"
            f"User input: {user_input!r}\n\n"
            "Pick the single closest-matching variant_id and your confidence (0-1)."
        )

        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    tools=[tool],
                    tool_config=genai_types.ToolConfig(
                        function_calling_config=genai_types.FunctionCallingConfig(
                            mode=genai_types.FunctionCallingConfigMode.ANY,
                            allowed_function_names=["select_clause_variant"],
                        )
                    ),
                    http_options=genai_types.HttpOptions(
                        timeout=settings.llm_timeout_seconds * 1000
                    ),
                ),
            )
        except Exception:
            return None

        try:
            for part in response.candidates[0].content.parts:
                fc = getattr(part, "function_call", None)
                if fc and fc.name == "select_clause_variant":
                    args = dict(fc.args)
                    return VariantChoice(
                        variant_id=str(args["variant_id"]),
                        confidence=float(args.get("confidence", 0.5)),
                    )
        except Exception:
            return None
        return None

    def generate_note(self, *, section_title: str, chosen_variant_id: str, user_input: str) -> str:
        client = self._client()
        if client is None:
            return ""

        prompt = (
            f"In one short plain-English sentence, explain what the '{section_title}' "
            f"section (variant: {chosen_variant_id}) means for a non-lawyer reading this "
            f"document. Do not write contract language — just explain it simply. "
            f"Context the user provided: {user_input!r}"
        )
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    http_options=genai_types.HttpOptions(
                        timeout=settings.llm_timeout_seconds * 1000
                    ),
                ),
            )
            return (response.text or "")[:500]
        except Exception:
            return ""


def get_llm_client() -> LLMClient:
    if settings.llm_provider == "anthropic":
        return AnthropicLLMClient()
    if settings.llm_provider == "gemini":
        return GeminiLLMClient()
    raise ValueError(f"Unsupported llm_provider: {settings.llm_provider!r}")
