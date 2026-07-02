"""
guardrail_classifier.py — Phase 6: LLM-based secondary guardrail classifier.

This is the SECOND layer of the guardrail. Layer 1 (guardrail.py) catches
obvious cases via a hard-coded denylist with zero API calls. This layer
catches ambiguous cases the denylist misses by asking the LLM to classify
the query as either "informational" or "specific_advice".

CONSERVATIVE DEFAULT — the core safety rule of this module:
  Any uncertainty routes the query to a human lawyer. Specifically:
    • If classification is "specific_advice"        → routed_to_human = True
    • If confidence < CONFIDENCE_THRESHOLD          → routed_to_human = True
    • If the API call fails for any reason          → routed_to_human = True
    • If the response cannot be parsed or validated → routed_to_human = True
  The function NEVER defaults to "safe to answer" on uncertainty.

Use run_guardrail() to wire both layers together. Don't call them separately.
"""

import json
import logging
import os
import re

from dotenv import load_dotenv
from groq import APIConnectionError, AuthenticationError, Groq, RateLimitError

load_dotenv()

logger = logging.getLogger(__name__)

MODEL = "llama-3.3-70b-versatile"

# Maximum character length accepted for a query.
# 1 000 characters is well above any normal user question.
MAX_QUERY_LENGTH = 1_000

# ─────────────────────────────────────────────────────────────────────────────
# CONFIDENCE THRESHOLD
#
# If the LLM's self-reported confidence is below this value, the query is
# routed to a human regardless of the classification label.
#
# Current value: 0.75 (conservative starting point).
#   Raise this to be MORE cautious (more queries go to humans).
#   Lower this to be LESS cautious (more queries reach the AI).
#
# Tune this number based on real test results and your legal team's review.
# Any change here automatically applies to every call — no other code changes
# are needed.
# ─────────────────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.75

# Valid classification labels the model may return.
VALID_CLASSIFICATIONS = {"informational", "specific_advice"}


# =============================================================================
# Internal helpers
# =============================================================================

def _validate_query(query):
    """Return an error string if query is invalid, or None if valid."""
    if not isinstance(query, str):
        return "query must be a string."
    if not query.strip():
        return "query must not be empty."
    if len(query) > MAX_QUERY_LENGTH:
        return (
            "Query is too long "
            "(" + str(len(query)) + " characters; "
            "maximum is " + str(MAX_QUERY_LENGTH) + ")."
        )
    return None


def _strip_markdown_fences(text):
    """Remove ```json ... ``` wrappers if the model includes them."""
    text = text.strip()
    match = re.match(r"^```(?:json)?\s*\n(.*)\n\s*```\s*$", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text


def _build_prompt(query):
    """
    Build the system prompt and user message for the classification call.

    The system prompt explains the two categories and includes four few-shot
    examples (two per category) to anchor the model's understanding.

    Built as a list of strings joined with newlines — same pattern as all
    other modules in this project — to avoid quote-mixing syntax errors.

    The query is concatenated into the user message (not formatted), so
    special characters in the query cannot be mistaken for template syntax.
    """

    # ── Few-shot examples ──────────────────────────────────────────────────
    # These are the primary tuning lever for classification accuracy.
    # Edit or add examples here if the model misclassifies common query types.
    # Keep examples paired (one informational, one specific_advice) and choose
    # ones that resemble the queries you actually receive in production.
    # ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ────

    prompt_lines = [
        "You are a legal query classifier for a legal-tech platform. Your only",
        "task is to classify a user query into exactly one of two categories:",
        "",
        "CATEGORY: informational",
        "  General educational questions about what a legal concept, clause, or",
        "  term typically means or how it usually works. The answer would be the",
        "  same regardless of who is asking or their specific circumstances.",
        "  The user is seeking knowledge, not a personal decision or assessment.",
        "",
        "CATEGORY: specific_advice",
        "  The user is asking:",
        "    - what THEY personally should do in their situation,",
        "    - whether something applies to THEIR specific contract or relationship,",
        "    - what THEIR rights, obligations, or options are,",
        "    - for an assessment or opinion on a specific document they have,",
        "    - anything involving an active dispute, legal conflict, or legal action.",
        "  The answer would differ depending on the user's particular facts.",
        "",
        "HARD RULE: when in doubt, choose specific_advice and set confidence",
        "below 0.75. It is safer to route a borderline query to a human lawyer",
        "than to let an AI answer one that is actually asking for personal advice.",
        "",
        "────────────────────────────────────────────────────────────────────",
        "FEW-SHOT EXAMPLES",
        "────────────────────────────────────────────────────────────────────",
        "",
        "Example 1 — informational:",
        '  Query: "What does a non-compete clause typically restrict?"',
        '  Output: {"classification": "informational", "confidence": 0.95,',
        '           "reason": "General question about what a clause type means;',
        '           no personal situation or decision involved."}',
        "",
        "Example 2 — specific_advice:",
        '  Query: "Should I sign this non-compete? My new job starts next month."',
        '  Output: {"classification": "specific_advice", "confidence": 0.99,',
        '           "reason": "User is asking for a personal decision about their',
        '           specific contract and timeline."}',
        "",
        "Example 3 — informational:",
        '  Query: "What are common notice period lengths in employment contracts?"',
        '  Output: {"classification": "informational", "confidence": 0.92,',
        '           "reason": "Asking about general industry norms, not the',
        '           user\'s own situation or contract."}',
        "",
        "Example 4 — specific_advice:",
        '  Query: "My employer wants me to sign a new IP clause. Is it standard?"',
        '  Output: {"classification": "specific_advice", "confidence": 0.93,',
        '           "reason": "User is asking for a personal assessment of their',
        '           specific employment relationship and document."}',
        "",
        "────────────────────────────────────────────────────────────────────",
        "OUTPUT FORMAT",
        "────────────────────────────────────────────────────────────────────",
        "",
        "Respond with ONLY a JSON object — no markdown, no explanation, nothing else:",
        "",
        "{",
        '  "classification": "informational" or "specific_advice",',
        '  "confidence": a number from 0.0 to 1.0,',
        '  "reason": one sentence explaining the classification (max 30 words)',
        "}",
    ]
    system_prompt = "\n".join(prompt_lines)

    # Query is in the user message (not the system prompt) and wrapped with
    # explicit markers so its content is structurally distinct from the
    # classification instructions above. A user who embeds something like
    # "ignore previous instructions" in their query cannot make the model
    # treat it as a system-level instruction.
    # Concatenated — not formatted — so special characters in the query are
    # never processed as Python format string placeholders.
    user_message = (
        "--- BEGIN QUERY ---\n"
        + query + "\n"
        "--- END QUERY ---\n"
        "\nClassify the query between the markers above."
    )

    return system_prompt, user_message


def _parse_and_validate_response(raw_text):
    """
    Parse and structurally validate the model's JSON response.

    Returns (parsed_dict, error_tag). If error_tag is not None, something
    failed and parsed_dict is None. The error_tag is used for internal logging
    — it is never returned to callers directly.
    """
    clean_text = _strip_markdown_fences(raw_text)

    try:
        parsed = json.loads(clean_text)
    except json.JSONDecodeError as exc:
        logger.error(
            "Classifier returned malformed JSON: %s | Raw (first 200 chars): %.200s",
            exc, raw_text,
        )
        return None, "malformed_json"

    if not isinstance(parsed, dict):
        logger.error(
            "Classifier response is not a JSON object. Raw (first 200 chars): %.200s",
            raw_text,
        )
        return None, "not_an_object"

    # Validate 'classification' — must be one of the two known labels.
    classification = parsed.get("classification")
    if classification not in VALID_CLASSIFICATIONS:
        logger.error(
            "Classifier returned invalid classification: %r. Expected one of: %s",
            classification, VALID_CLASSIFICATIONS,
        )
        return None, "invalid_classification"

    # Validate 'confidence' — must be a number in [0.0, 1.0].
    confidence = parsed.get("confidence")
    if not isinstance(confidence, (int, float)):
        logger.error(
            "Classifier returned non-numeric confidence: %r", confidence
        )
        return None, "invalid_confidence"
    if not (0.0 <= float(confidence) <= 1.0):
        logger.error(
            "Classifier confidence out of range [0.0, 1.0]: %r", confidence
        )
        return None, "confidence_out_of_range"

    # 'reason' is expected but not strictly required for routing to work.
    # If the model omits it or returns the wrong type, default to empty string.
    if not isinstance(parsed.get("reason"), str):
        parsed["reason"] = ""

    return parsed, None


# =============================================================================
# Public API
# =============================================================================

def classify_query(query):
    """
    Use the LLM to classify a query as "informational" or "specific_advice".

    This is the second layer of the guardrail. Call run_guardrail() to
    automatically run both layers in the correct order instead of calling
    this function directly.

    Arguments:
        query   The user's question string (max MAX_QUERY_LENGTH characters).

    Returns a dict with five keys:
        routed_to_human   bool   True if the query must go to a human lawyer.
        classification    str    "informational" or "specific_advice", or None
                                 if parsing failed.
        confidence        float  Model's self-reported confidence (0.0–1.0),
                                 or None if parsing failed.
        reason            str    Model's reason for the classification, or a
                                 system note explaining the conservative default.
        error             str    A safe user-facing error message, or None.

    CONSERVATIVE DEFAULT: routed_to_human is True whenever:
      - Input validation fails
      - The API call fails for any reason
      - The response cannot be parsed or validated
      - classification is "specific_advice"
      - confidence < CONFIDENCE_THRESHOLD (even if classification is "informational")

    This function never raises. All errors are caught and returned in the dict.
    """

    # ── Step 1: Validate input (no API call if this fails) ────────────────────
    validation_error = _validate_query(query)
    if validation_error:
        # Conservative default: invalid input → route to human.
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          validation_error,
            "error":           validation_error,
        }

    # ── Step 2: Get API key ───────────────────────────────────────────────────
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        logger.error("GROQ_API_KEY is not set in the environment.")
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "Classifier not configured; conservative default applied.",
            "error":           "The classification service is not configured. Contact your administrator.",
        }

    # ── Step 3: Build prompt ──────────────────────────────────────────────────
    system_prompt, user_message = _build_prompt(query)

    # ── Step 4: Call the API ──────────────────────────────────────────────────
    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            # Force valid JSON output. System prompt also mentions "JSON" as
            # required for this mode to activate reliably on the Groq API.
            response_format={"type": "json_object"},
        )
        raw_text = response.choices[0].message.content.strip()

    except AuthenticationError:
        logger.error("Groq authentication failed — API key may be invalid.")
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "API authentication failed; conservative default applied.",
            "error":           "Authentication failed. Check that your API key is correct.",
        }

    except RateLimitError:
        logger.error("Groq rate limit exceeded.")
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "Rate limit exceeded; conservative default applied.",
            "error":           "The service is temporarily busy. Please try again in a moment.",
        }

    except APIConnectionError as exc:
        logger.error("Groq API connection error: %s", exc)
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "API connection error; conservative default applied.",
            "error":           (
                "Could not reach the classification service. "
                "Check your internet connection and try again."
            ),
        }

    except Exception as exc:
        logger.exception("Unexpected error during query classification: %s", exc)
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "Unexpected error; conservative default applied.",
            "error":           "An unexpected error occurred. Please try again.",
        }

    if not raw_text:
        logger.error("Classifier returned an empty response.")
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "Empty model response; conservative default applied.",
            "error":           "The classification service returned an empty response. Please try again.",
        }

    # ── Step 5: Parse and validate the response ───────────────────────────────
    parsed, parse_error = _parse_and_validate_response(raw_text)

    if parse_error is not None:
        # Conservative default: unreadable response → route to human.
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "Response could not be parsed (" + parse_error + "); conservative default applied.",
            "error":           "The classification service returned an unexpected response. Please try again.",
        }

    classification = parsed["classification"]
    confidence     = float(parsed["confidence"])
    reason         = parsed["reason"]

    # ── Step 6: Apply conservative routing logic ──────────────────────────────
    #
    # A query is safe for the AI to answer ONLY if BOTH conditions hold:
    #   1. The model labelled it "informational"
    #   2. The model's confidence is at or above CONFIDENCE_THRESHOLD
    #
    # Either condition failing alone is enough to route to a human.

    if classification == "specific_advice":
        routed_to_human = True
        # reason is already the model's explanation; no change needed.

    elif confidence < CONFIDENCE_THRESHOLD:
        # Model said "informational" but wasn't confident enough.
        # Conservative default: treat it the same as specific_advice.
        routed_to_human = True
        reason = (
            "Low confidence ("
            + "{:.2f}".format(confidence) + " < "
            + "{:.2f}".format(CONFIDENCE_THRESHOLD)
            + "); conservative default applied. Model reason: " + reason
        )

    else:
        # classification == "informational" AND confidence >= threshold.
        routed_to_human = False

    return {
        "routed_to_human": routed_to_human,
        "classification":  classification,
        "confidence":      confidence,
        "reason":          reason,
        "error":           None,
    }


def run_guardrail(query, denylist_check_fn):
    """
    Run both guardrail layers in order and return a single routing decision.

    This is the main entry point for the guardrail system. Always call this
    function — do not call check_denylist or classify_query separately.

    Layer 1 — denylist (guardrail.py): runs first, no API call.
    Layer 2 — LLM classifier (this module): only runs if Layer 1 did not match.

    Arguments:
        query               The user's question string.
        denylist_check_fn   The check_denylist function from guardrail.py.
                            Passed as a parameter so neither module imports the
                            other — the layers stay fully decoupled.

    Returns a consistent dict with five keys regardless of which layer fired:
        routed_to_human   bool   True → send to a human lawyer.
                                 False → safe to pass to the AI layer.
        classification    str    "informational", "specific_advice", or None.
                                 None when the denylist made the decision
                                 (no LLM classification was performed).
        confidence        float  LLM confidence score, or None if the denylist
                                 fired (no LLM was called).
        reason            str    "denylist_match" when Layer 1 fired; the
                                 model's reason or a system note when Layer 2 fired.
        error             str    A safe user-facing error message, or None.
    """

    # ── Layer 1: denylist ─────────────────────────────────────────────────────
    # Fast, no API call. If it matches, we stop here and do not call the LLM.
    # Wrapped in try/except so that an unexpected failure in the denylist
    # function defaults to routing to a human (conservative) rather than
    # crashing or silently falling through to the LLM layer.
    try:
        denylist_result = denylist_check_fn(query)
    except Exception as exc:
        logger.exception("Denylist function raised an unexpected exception: %s", exc)
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "Denylist error; conservative default applied.",
            "error":           "An unexpected error occurred in the guardrail. Please try again.",
        }

    if denylist_result.get("routed_to_human"):
        return {
            "routed_to_human": True,
            "classification":  None,
            "confidence":      None,
            "reason":          "denylist_match",
            "error":           None,
        }

    # ── Layer 2: LLM classifier ───────────────────────────────────────────────
    # Denylist found no match — ask the model to make the call.
    return classify_query(query)
