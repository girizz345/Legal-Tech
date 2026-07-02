"""
guardrail.py — Phase 2: Hard-coded denylist classifier.

Runs BEFORE any LLM call. Pure pattern-matching — no API, no model.
If a query matches any denylist pattern it is routed to a human lawyer.
If nothing matches, the query may proceed to later classification steps.

A legal professional should review the DENYLIST below periodically
to add, remove, or refine patterns as the product evolves.
"""

import re

# Maximum query length accepted by check_denylist. 10 000 characters is far
# beyond any plausible user question; anything longer is rejected outright to
# prevent regex matching on enormous strings.
MAX_QUERY_LENGTH = 10_000


# ─────────────────────────────────────────────────────────────────────────────
# DENYLIST — patterns that always mean "route to a human lawyer".
#
# How matching works:
#   • Each entry is matched case-insensitively as a substring anywhere in
#     the user's query (e.g. "what should i do" catches "What should I do
#     about this clause?").
#   • Entries that start/end with \b are word-boundary markers that prevent
#     matching inside longer words (e.g. \bsue\b won't match "issue").
#   • Keep entries short and specific — one clear intent per line.
#   • To add a new pattern: paste it in the appropriate section below,
#     one entry per line, as a quoted string.
# ─────────────────────────────────────────────────────────────────────────────

DENYLIST = [

    # ── 1. Requests for advice on the user's specific situation ──────────────
    #    The user is asking what THEY should do, not what a clause generally means.
    "what should i do",
    "what do i do",
    "should i sign",
    "should i agree",
    "should i accept",
    "what would you recommend",
    "what do you recommend",
    "advise me",
    "my best option",
    "what are my options",

    # ── 2. Questions about legality of the user's specific situation ──────────
    #    Asking whether something is legal, valid, or enforceable FOR THEM.
    r"\bam i liable",
    "is this legal for me",
    r"\benforceable\b",
    "can they do this to me",
    "do i have to",
    r"\bcan i be sued",
    "am i protected",
    "will i be held responsible",
    "could i get in trouble",

    # ── 3. Requests for a course of action ───────────────────────────────────
    #    The user wants to know what action to take next in their situation.
    "how do i respond",
    "how should i respond",
    "how should i handle",
    "how do i get out of",
    "how can i get out of",
    "how can i avoid",
    "what steps should i take",
    "how do i contest",
    "how do i challenge",
    "how do i dispute",

    # ── 4. Adversarial / legal action language ────────────────────────────────
    #    The user is describing or asking about an active legal conflict.
    r"\bsue\b",
    r"\bsuing\b",
    r"\blawsuit\b",
    "legal action",
    "demand letter",
    "cease and desist",
    r"\blitigation\b",
    "file a claim",
    "take to court",
    r"\binjunction\b",

]


def check_denylist(query: str) -> dict:
    """
    Check a user query against the denylist.

    Returns a dict with three keys:
      routed_to_human  bool   True if the query matched a denylist pattern,
                             or if the input failed validation.
      matched_phrase   str    The text in the query that triggered the match,
                             or None if no match or invalid input.
      reason           str    "denylist_match", "no_match", or "invalid_input".
    """
    # Validate input before running any regex. Non-string or over-length inputs
    # are rejected conservatively (routed_to_human=True) rather than crashing or
    # silently passing through.
    if not isinstance(query, str):
        return {"routed_to_human": True, "matched_phrase": None, "reason": "invalid_input"}
    if not query.strip():
        return {"routed_to_human": True, "matched_phrase": None, "reason": "invalid_input"}
    if len(query) > MAX_QUERY_LENGTH:
        return {"routed_to_human": True, "matched_phrase": None, "reason": "invalid_input"}

    for pattern in DENYLIST:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            return {
                "routed_to_human": True,
                "matched_phrase": match.group(),
                "reason": "denylist_match",
            }

    return {
        "routed_to_human": False,
        "matched_phrase": None,
        "reason": "no_match",
    }
