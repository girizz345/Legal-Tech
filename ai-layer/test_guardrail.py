"""
test_guardrail.py — Smoke-tests for the Phase 2 denylist classifier.

Each test specifies a query and whether it should be routed to a human.
Run with:  python test_guardrail.py
"""

from guardrail import check_denylist


# ─────────────────────────────────────────────────────────────────────────────
# TEST CASES
# Format: (query, expected_routed_to_human)
#
# True  = denylist should catch this and route to a human lawyer.
# False = denylist should pass this through (general informational question).
# ─────────────────────────────────────────────────────────────────────────────

TESTS = [
    # ── Should be caught (routed to human) ───────────────────────────────────

    # Advice on user's specific situation
    ("What should I do about the non-compete clause in my contract?",   True),
    ("Should I sign this NDA before the client meeting?",               True),
    ("Should I agree to these payment terms?",                          True),
    ("What do you recommend I do here?",                                True),

    # Legality of user's specific situation
    ("Am I liable if I accidentally share a confidential file?",        True),
    ("Is this non-compete clause enforceable against me?",              True),
    ("Do I have to comply with this clause even after leaving?",        True),
    ("Can I be sued for sharing trade secrets with a new employer?",    True),

    # Course of action
    ("How do I respond to this breach of contract notice?",             True),
    ("How should I handle this situation with my former employer?",     True),
    ("How do I get out of this contract before the end date?",          True),
    ("What steps should I take after receiving this termination letter?", True),

    # Adversarial / legal conflict
    ("Can they sue me for not renewing the agreement?",                 True),
    ("My client sent a demand letter — what do I do?",                  True),
    ("There's a lawsuit being filed against me — what are my options?", True),
    ("They sent a cease and desist. Advise me.",                        True),

    # ── Should NOT be caught (general informational questions) ───────────────

    ("What does a non-disclosure agreement typically include?",         False),
    ("Explain what an indemnification clause means.",                   False),
    ("What is the standard notice period in employment contracts?",     False),
    ("How does intellectual property ownership work in contractor agreements?", False),
    ("What does 'force majeure' mean in a contract?",                   False),
    ("What is the difference between a unilateral and mutual NDA?",     False),
    ("Summarize the termination clause in plain language.",             False),
    ("What does an arbitration clause typically cover?",                False),
    ("What is a governing law clause?",                                 False),
]


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

def run_tests():
    passed = 0
    failed = 0
    col = 70  # column width for query display

    print(f"\n{'-' * (col + 12)}")
    print(f"  {'QUERY':<{col}}  EXPECTED   RESULT")
    print(f"{'-' * (col + 12)}")

    for query, expected in TESTS:
        result = check_denylist(query)
        actual = result["routed_to_human"]
        ok = actual == expected

        status = "PASS" if ok else "FAIL"
        expected_label = "HUMAN " if expected else "AI    "
        actual_label   = "HUMAN " if actual   else "AI    "

        truncated = (query[:col - 3] + "...") if len(query) > col else query
        print(f"  {truncated:<{col}}  {expected_label}  ->  {actual_label}  [{status}]")

        if not ok:
            print(f"    {'':>{col}}  matched: {result['matched_phrase']!r}")

        if ok:
            passed += 1
        else:
            failed += 1

    print(f"{'-' * (col + 12)}")
    print(f"  {passed} passed, {failed} failed  ({len(TESTS)} total)\n")

    if failed > 0:
        print("  ACTION REQUIRED: review failed cases above.")
        print("  A 'HUMAN' result on a safe query = false positive (overly restrictive).")
        print("  An 'AI' result on an advice query = false negative (must fix before deploy).\n")


if __name__ == "__main__":
    run_tests()
