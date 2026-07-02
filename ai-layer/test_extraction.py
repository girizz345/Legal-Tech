"""
test_extraction.py - Tests for the Phase 4 term extraction job.

Tests 1-2 run entirely offline (input validation only, no API call).
Tests 3-5 call the Groq API and are skipped if GROQ_API_KEY is not set.

Run with:  python test_extraction.py
"""

import logging
import os

from dotenv import load_dotenv

from extraction import LOW_CONFIDENCE_THRESHOLD, extract_terms

load_dotenv()

# Show WARNING+ logs from extraction.py so internal error detail is visible
# during testing. In production, configure this via your app's log settings.
logging.basicConfig(level=logging.WARNING, format="  [LOG] %(name)s: %(message)s")


# =============================================================================
# SAMPLE CONTRACT FIXTURES
#
# Clearly fake documents for testing only. Not real contracts.
# Three samples chosen to cover different extraction difficulty levels:
#   SAMPLE_A - all fields present and explicit (expect high confidence)
#   SAMPLE_B - NDA with no monetary value; some fields require inference
#   SAMPLE_C - vague agreement with several fields missing or ambiguous
#              (expect low confidence flags)
# =============================================================================

SAMPLE_A = """
SERVICES AGREEMENT

This Services Agreement ("Agreement") is entered into as of 15 March 2025
by and between TechStart Solutions Limited, a company incorporated in
England and Wales ("Service Provider") and Global Retail PLC, a company
incorporated in England and Wales ("Client").

1. SERVICES
   Service Provider will provide software development consultancy services
   as described in Schedule A attached hereto.

2. FEES
   Client shall pay Service Provider GBP 8,500 per month, payable within
   30 days of receipt of each invoice.

3. TERM AND RENEWAL
   This Agreement commences on 1 April 2025 and continues for an initial
   period of 12 months. It will automatically renew for successive 12-month
   periods unless either party gives the other not less than 60 days written
   notice of non-renewal prior to the end of the then-current term.

4. TERMINATION
   Either party may terminate this Agreement for convenience upon 60 days
   written notice to the other party. Either party may terminate this
   Agreement immediately upon written notice if the other party commits a
   material breach of this Agreement that remains uncured for 14 days after
   written notice of such breach.

5. GOVERNING LAW
   This Agreement is governed by the laws of England and Wales.
""".strip()


SAMPLE_B = """
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement is entered into as of 1 June 2025 by and
between Innovate Labs Ltd ("Disclosing Party") and Sarah Chen, an individual
("Receiving Party").

1. CONFIDENTIAL INFORMATION
   "Confidential Information" means any non-public technical, financial, or
   business information disclosed by the Disclosing Party to the Receiving
   Party, whether orally or in writing.

2. OBLIGATIONS
   The Receiving Party agrees to: (a) keep all Confidential Information
   strictly confidential; (b) not disclose it to any third party without
   prior written consent; and (c) use it solely for the purpose of evaluating
   a potential business relationship between the parties.

3. DURATION
   The obligations under this Agreement shall continue for three (3) years
   from the Effective Date.

4. TERMINATION
   Either party may terminate this Agreement at any time by providing 30
   days written notice to the other party.

5. RETURN OF INFORMATION
   Upon termination or written request, the Receiving Party shall promptly
   return or destroy all Confidential Information and certify destruction
   in writing.
""".strip()


SAMPLE_C = """
CONSULTING AGREEMENT

This agreement is entered into between Vertex Consulting ("Consultant") and
the client identified in the attached Schedule ("Client").

The Consultant will provide strategic advisory services on an ongoing basis
as reasonably requested by the Client.

Fees will be agreed in writing at the start of each project and invoiced
on completion.

Either party may bring this arrangement to an end at any time by giving the
other reasonable written notice.
""".strip()


# =============================================================================
# Test runner helpers
# =============================================================================

def print_terms(terms):
    """Print extracted terms in a readable format with confidence flags."""
    if terms is None:
        print("    (no terms returned)")
        return
    for field_key, entry in terms.items():
        confidence = entry.get("confidence", 0.0)
        extracted  = entry.get("extracted")
        flag = " [LOW CONFIDENCE]" if confidence < LOW_CONFIDENCE_THRESHOLD else ""
        if isinstance(extracted, list):
            value_str = ", ".join(str(v) for v in extracted) if extracted else "not found"
        else:
            value_str = str(extracted) if extracted is not None else "not found"
        print(
            "    {:22s}  conf={:.2f}{}  ->  {}".format(
                field_key, confidence, flag, value_str
            )
        )


def print_result(label, result, expect_success):
    ok = result["success"] == expect_success
    status = "PASS" if ok else "FAIL"
    print("  [{}] {}".format(status, label))
    print("       success               : {}".format(result["success"]))
    if result["error"]:
        print("       error                 : {}".format(result["error"]))
    if result["low_confidence_fields"]:
        print("       low_confidence_fields : {}".format(result["low_confidence_fields"]))
    if result["terms"]:
        print("       extracted terms:")
        print_terms(result["terms"])
    return ok


def run_tests():
    passed = 0
    total  = 0
    api_available = bool(os.environ.get("GROQ_API_KEY"))

    # ---- Test 1: Empty input (offline) --------------------------------------
    print("\n" + "=" * 72)
    print("Test 1 - Empty input (offline, no API call)")
    print("=" * 72)

    result = extract_terms("")
    ok = print_result("Empty string", result, expect_success=False)
    passed += ok
    total  += 1

    # ---- Test 2: Excessively long input (offline) ---------------------------
    print("\n" + "=" * 72)
    print("Test 2 - Input too long (offline, no API call)")
    print("=" * 72)

    huge_text = "A" * 35_000
    result = extract_terms(huge_text)
    ok = print_result(
        "35 000-character string (limit is 30 000)",
        result,
        expect_success=False,
    )
    passed += ok
    total  += 1

    # ---- API tests (require GROQ_API_KEY) -----------------------------------
    if not api_available:
        print("\n" + "=" * 72)
        print("Tests 3-5 SKIPPED - GROQ_API_KEY not set in .env")
        print("=" * 72)
    else:
        # ---- Test 3: Services agreement (all fields present) ----------------
        print("\n" + "=" * 72)
        print("Test 3 - Services agreement (all fields explicit, expect high confidence)")
        print("=" * 72)
        print("  Calling Groq API, please wait...")
        result = extract_terms(SAMPLE_A)
        ok = print_result("SAMPLE_A: services agreement", result, expect_success=True)
        passed += ok
        total  += 1

        # ---- Test 4: NDA (no monetary value, some inference needed) ---------
        print("\n" + "=" * 72)
        print("Test 4 - NDA (no monetary value, some inference needed)")
        print("=" * 72)
        print("  Calling Groq API, please wait...")
        result = extract_terms(SAMPLE_B)
        ok = print_result("SAMPLE_B: NDA", result, expect_success=True)
        passed += ok
        total  += 1

        # ---- Test 5: Vague consulting agreement (several fields missing) ----
        print("\n" + "=" * 72)
        print("Test 5 - Vague consulting agreement (several fields missing/ambiguous)")
        print("         Expect low_confidence_fields to be non-empty")
        print("=" * 72)
        print("  Calling Groq API, please wait...")
        result = extract_terms(SAMPLE_C)
        ok = print_result("SAMPLE_C: vague agreement", result, expect_success=True)
        # Additionally check that we got at least one low-confidence flag
        if result["success"] and not result["low_confidence_fields"]:
            print("  NOTE: expected some low-confidence fields but none were flagged.")
            print("        Consider reviewing the LOW_CONFIDENCE_THRESHOLD in extraction.py.")
        passed += ok
        total  += 1

    # ---- Summary ------------------------------------------------------------
    print("\n" + "=" * 72)
    print("  {} passed, {} failed  ({} tests run)".format(
        passed, total - passed, total
    ))

    if total - passed > 0:
        print()
        print("  ACTION REQUIRED: review failed cases above.")
        print("  A validation test failing = input validation logic may have changed.")
        print("  An API test failing = check your .env key or Groq service status.")

    if not api_available:
        print()
        print("  Add GROQ_API_KEY to .env to also run the extraction tests (Tests 3-5).")

    print()


if __name__ == "__main__":
    run_tests()
