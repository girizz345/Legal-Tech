"""
test_generation.py — Tests for the Phase 3 document generation job.

Tests 1 and 2 run entirely offline (no API call — they test input
validation only). Test 3 calls the Groq API and is skipped if
GROQ_API_KEY is not set in .env.

Run with:  python test_generation.py
"""

import logging
import os

from dotenv import load_dotenv

from generation import EXAMPLE_NDA_TEMPLATE, generate_document

load_dotenv()

# Show WARNING+ logs from generation.py so internal error detail is visible
# during testing. In production, configure this via your app's log settings.
logging.basicConfig(level=logging.WARNING, format="  [LOG] %(name)s: %(message)s")


# ── Sample data ───────────────────────────────────────────────────────────────

VALID_ANSWERS = {
    "party_a_name":                "Acme Corp Ltd",
    "party_b_name":                "Jane Smith",
    "effective_date":              "1 July 2026",
    "jurisdiction":                "England and Wales",
    "confidentiality_period_years": "2",
}


# ── Test runner helpers ───────────────────────────────────────────────────────

def print_result(label: str, result: dict, expect_success: bool, expect_flagged: bool = False) -> bool:
    ok = (result["success"] == expect_success) and (result["flagged"] == expect_flagged)
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {label}")
    print(f"         success  : {result['success']}")
    print(f"         flagged  : {result['flagged']}")
    if result["error"]:
        print(f"         error    : {result['error']}")
    if result["document_text"]:
        preview = result["document_text"][:160].replace("\n", " ")
        print(f"         document : {preview} ...")
    return ok


def run_tests():
    passed = 0
    total  = 0

    # ── Test 1: Missing required fields ──────────────────────────────────────
    # Expects: validation fails before any API call; error names the missing fields.
    print("\n" + "=" * 70)
    print("Test 1 — Missing required fields (offline, no API call)")
    print("=" * 70)

    incomplete_answers = {
        "party_a_name":                "Acme Corp Ltd",
        # party_b_name intentionally omitted
        "effective_date":              "1 July 2026",
        # jurisdiction intentionally omitted
        "confidentiality_period_years": "2",
    }
    result = generate_document(EXAMPLE_NDA_TEMPLATE, incomplete_answers)
    ok = print_result(
        "Missing party_b_name and jurisdiction",
        result,
        expect_success=False,
    )
    print(f"         (error should name 'party_b_name' and 'jurisdiction')")
    passed += ok
    total  += 1

    # ── Test 2: Absurdly long field value ─────────────────────────────────────
    # Expects: validation rejects the oversize value; no API call made.
    print("\n" + "=" * 70)
    print("Test 2 — Oversized field value (offline, no API call)")
    print("=" * 70)

    oversized_answers = {**VALID_ANSWERS, "party_a_name": "A" * 600}
    result = generate_document(EXAMPLE_NDA_TEMPLATE, oversized_answers)
    ok = print_result(
        "party_a_name is 600 characters (limit is 500)",
        result,
        expect_success=False,
    )
    passed += ok
    total  += 1

    # ── Test 3: Empty string in a required field ───────────────────────────────
    # Expects: validation rejects blank value; no API call made.
    print("\n" + "=" * 70)
    print("Test 3 — Empty string in required field (offline, no API call)")
    print("=" * 70)

    empty_field_answers = {**VALID_ANSWERS, "jurisdiction": "   "}
    result = generate_document(EXAMPLE_NDA_TEMPLATE, empty_field_answers)
    ok = print_result(
        "jurisdiction is blank/whitespace",
        result,
        expect_success=False,
    )
    passed += ok
    total  += 1

    # ── Test 4: Non-string field value ────────────────────────────────────────
    # Expects: validation rejects non-string; no API call made.
    print("\n" + "=" * 70)
    print("Test 4 — Non-string field value (offline, no API call)")
    print("=" * 70)

    wrong_type_answers = {**VALID_ANSWERS, "confidentiality_period_years": 2}  # int, not str
    result = generate_document(EXAMPLE_NDA_TEMPLATE, wrong_type_answers)
    ok = print_result(
        "confidentiality_period_years supplied as int instead of str",
        result,
        expect_success=False,
    )
    passed += ok
    total  += 1

    # ── Test 5: Valid complete answers (requires API key) ─────────────────────
    # Expects: API call succeeds, document_text is a non-empty string.
    print("\n" + "=" * 70)
    print("Test 5 — Valid complete answers (calls Groq API)")
    print("=" * 70)

    if not os.environ.get("GROQ_API_KEY"):
        print("  [SKIP] GROQ_API_KEY not set — add it to .env to run this test.")
    else:
        print("  Calling Groq API, please wait...")
        result = generate_document(EXAMPLE_NDA_TEMPLATE, VALID_ANSWERS)
        ok = print_result(
            "All fields valid — expect generated document",
            result,
            expect_success=True,
            expect_flagged=False,
        )
        passed += ok
        total  += 1

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"  {passed} passed, {total - passed} failed  ({total} tests run)")

    if total - passed > 0:
        print()
        print("  ACTION REQUIRED: review failed cases above.")
        print("  A validation test failing = the validation logic may have changed.")
        print("  The API test failing = check your .env key or the Groq service status.")

    print()


if __name__ == "__main__":
    run_tests()
