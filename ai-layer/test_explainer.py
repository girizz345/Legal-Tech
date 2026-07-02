"""
test_explainer.py - Tests for the Phase 5 plain-language clause explainer.

Tests 1-2 run offline (input validation only - no model, no API call).
Tests 3-5 load the local embedding model and call the Groq API.
Tests 3-5 are skipped if GROQ_API_KEY is not set in .env.

Key things to review in the output:
  - Does the answer stay informational? (No "should", "I recommend", etc.)
  - Does the model's inline Source: line match the cited_source in the dict?
  - Does the explanation actually address the clause content provided?

Run with:  python test_explainer.py
"""

import logging
import os

from dotenv import load_dotenv

from explainer import EXAMPLE_KB, build_knowledge_base_index, explain_clause

load_dotenv()

# Show WARNING+ from explainer.py so low-similarity warnings appear in test output.
logging.basicConfig(level=logging.WARNING, format="  [LOG] %(name)s: %(message)s")


# =============================================================================
# SAMPLE CONTRACT CLAUSES
#
# Clearly fake text for testing only - not real legal documents.
# Three clauses chosen to map cleanly to different KB entries.
# =============================================================================

NOTICE_PERIOD_CLAUSE = """\
14. NOTICE OF TERMINATION

Either party may terminate this Agreement by giving the other party not less
than sixty (60) days prior written notice. Notice shall be deemed given when
delivered by email to the address set out in Schedule 1, or when sent by
recorded post to the registered address of the receiving party.\
"""

CONFIDENTIALITY_CLAUSE = """\
7. CONFIDENTIALITY

Each party agrees to keep the other party's Confidential Information strictly
confidential and not to disclose it to any third party without prior written
consent. This obligation shall continue for a period of three (3) years
following termination of this Agreement. "Confidential Information" excludes
any information that is or becomes publicly available through no breach of
this clause.\
"""

FORCE_MAJEURE_CLAUSE = """\
19. FORCE MAJEURE

Neither party shall be in breach of this Agreement or liable for delay in
performing, or failure to perform, any of its obligations under this Agreement
if such delay or failure results from events, circumstances or causes beyond its
reasonable control, including without limitation acts of God, floods, lightning,
severe weather, strikes, lock-outs, industrial disputes, or acts of government.
The affected party shall notify the other in writing within five (5) business
days of becoming aware of such an event. If the force majeure event continues
for more than ninety (90) days, either party may terminate this Agreement on
thirty (30) days written notice.\
"""


# =============================================================================
# Test runner helpers
# =============================================================================

# Words that would indicate the model slipped into giving advice.
# The test prints a prominent flag if any are found in the answer.
# These are user-directed advice phrases - the real compliance risk.
# "should" alone is NOT listed here because it appears legitimately in
# informational language (e.g. "this clause generally means that X should...").
# The model is instructed to avoid "you should" specifically, not "should" everywhere.
ADVICE_WORDS = ["you should", "i recommend", "you must", "i advise", "in your case",
                "you ought", "my advice", "i suggest"]


def check_for_advice_language(answer):
    """
    Scan the answer for advice-sounding phrases.
    Returns a list of matches found (empty list = clean).
    """
    lower = answer.lower()
    return [phrase for phrase in ADVICE_WORDS if phrase in lower]


def print_result(label, result, expect_success):
    ok = result["success"] == expect_success
    status = "PASS" if ok else "FAIL"
    print("  [{}] {}".format(status, label))
    print("       success      : {}".format(result["success"]))

    if result["error"]:
        print("       error        : {}".format(result["error"]))

    if result["cited_source"]:
        print("       cited_source : {}".format(result["cited_source"]))

    if result["answer"]:
        # Flag any advice-sounding language before printing
        matches = check_for_advice_language(result["answer"])
        if matches:
            print("       *** COMPLIANCE WARNING: answer contains advice-sounding "
                  "phrases: {} ***".format(matches))

        print("       answer:")
        # Indent each line of the answer for readability
        for line in result["answer"].split("\n"):
            print("         " + line)

    return ok


def run_tests():
    passed = 0
    total  = 0
    api_available = bool(os.environ.get("GROQ_API_KEY"))

    # ---- Test 1: Empty question (offline, validation only) ------------------
    print("\n" + "=" * 72)
    print("Test 1 - Empty question (offline, no model or API call)")
    print("=" * 72)

    # Pass None as kb_index - validation of the question happens first,
    # so kb_index is never touched.
    result = explain_clause("", NOTICE_PERIOD_CLAUSE, kb_index=None)
    ok = print_result("Empty question string", result, expect_success=False)
    passed += ok
    total  += 1

    # ---- Test 2: Clause too long (offline, validation only) -----------------
    print("\n" + "=" * 72)
    print("Test 2 - Contract clause too long (offline, no model or API call)")
    print("=" * 72)

    long_clause = "X " * 3_000   # 6 000 characters, over the 5 000 limit
    result = explain_clause("What does this clause mean?", long_clause, kb_index=None)
    ok = print_result(
        "Clause is 6 000 characters (limit is 5 000)",
        result,
        expect_success=False,
    )
    passed += ok
    total  += 1

    # ---- Build KB index (loads local model - fast after first download) -----
    if api_available:
        print("\n  Building knowledge base index (loading local embedding model)...")
        kb_index = build_knowledge_base_index(EXAMPLE_KB)
        print("  Index built. {} entries embedded.".format(len(EXAMPLE_KB)))
    else:
        kb_index = None

    # ---- Test 3: Notice period clause (API required) ------------------------
    print("\n" + "=" * 72)
    print("Test 3 - Notice period clause")
    print("         Expect: KB match = 'Notice period clause'")
    print("=" * 72)

    if not api_available:
        print("  [SKIP] GROQ_API_KEY not set in .env")
    else:
        print("  Calling Groq API, please wait...")
        result = explain_clause(
            question        = "What does this termination notice clause mean?",
            contract_clause = NOTICE_PERIOD_CLAUSE,
            kb_index        = kb_index,
        )
        ok = print_result("Notice period explanation", result, expect_success=True)
        passed += ok
        total  += 1

    # ---- Test 4: Confidentiality clause (API required) ----------------------
    print("\n" + "=" * 72)
    print("Test 4 - Confidentiality clause")
    print("         Expect: KB match = 'Confidentiality / NDA clause'")
    print("=" * 72)

    if not api_available:
        print("  [SKIP] GROQ_API_KEY not set in .env")
    else:
        print("  Calling Groq API, please wait...")
        result = explain_clause(
            question        = "What does this confidentiality clause require?",
            contract_clause = CONFIDENTIALITY_CLAUSE,
            kb_index        = kb_index,
        )
        ok = print_result("Confidentiality explanation", result, expect_success=True)
        passed += ok
        total  += 1

    # ---- Test 5: Force majeure clause (API required) ------------------------
    print("\n" + "=" * 72)
    print("Test 5 - Force majeure clause")
    print("         Expect: KB match = 'Force majeure clause'")
    print("=" * 72)

    if not api_available:
        print("  [SKIP] GROQ_API_KEY not set in .env")
    else:
        print("  Calling Groq API, please wait...")
        result = explain_clause(
            question        = "What happens under this force majeure clause if a "
                              "natural disaster prevents us from delivering?",
            contract_clause = FORCE_MAJEURE_CLAUSE,
            kb_index        = kb_index,
        )
        ok = print_result("Force majeure explanation", result, expect_success=True)
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

    if not api_available:
        print()
        print("  Tests 3-5 were skipped. Add GROQ_API_KEY to .env to run them.")

    print()
    if api_available:
        print("  MANUAL REVIEW CHECKLIST:")
        print("  - Do the answers stay informational? (No 'should', 'I recommend', etc.)")
        print("  - Does each cited_source match the question topic?")
        print("  - Are legal terms explained in plain language?")
        print()


if __name__ == "__main__":
    run_tests()
