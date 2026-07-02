# AI Layer — Legal Tech MVP

Standalone LLM integration module using [Groq](https://console.groq.com) as the inference provider.
No app framework, no database. Each phase builds on the last.

---


## Setup

### 1. Prerequisites

- Python 3.9 or later
- A free Groq API key — sign up at <https://console.groq.com> (no credit card required)

### 2. Create and activate a virtual environment

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Add your API key

```bash
copy .env.example .env      # Windows
# or
cp .env.example .env        # macOS / Linux
```

Open `.env` and replace `your_groq_api_key_here` with your key from the Groq console.

---

## Phase 1 — API smoke-test

Confirms the Groq connection works. Requires an API key in `.env`.

```bash
python test_call.py
```

Expected output:
```
Model : llama-3.3-70b-versatile
Prompt: Explain in one sentence what a non-disclosure agreement is.
------------------------------------------------------------
A non-disclosure agreement (NDA) is a legally binding contract ...
```

---

## Phase 2 — Denylist guardrail

`guardrail.py` is a pure pattern-matching classifier that runs **before any LLM call**.
It checks a user query against a hard-coded list of phrases and returns whether the
query should be routed to a human lawyer or is safe to pass to the AI.

The denylist covers four categories:
1. Requests for advice on the user's specific situation ("what should I do", "should I sign")
2. Questions about legality of the user's situation ("am I liable", "is this enforceable")
3. Requests for a course of action ("how do I respond", "how do I get out of")
4. Adversarial / legal action language ("sue", "lawsuit", "demand letter", "cease and desist")

To edit the denylist, open `guardrail.py` and modify the `DENYLIST` constant near the top.
Each entry is a commented, categorised string — no programming knowledge required to add or remove patterns.

**Run the classifier tests** (no API key needed):

```bash
python test_guardrail.py
```

Expected output:
```
----------------------------------------------------------------------------------
  QUERY                                                                   EXPECTED   RESULT
----------------------------------------------------------------------------------
  What should I do about the non-compete clause in my contract?           HUMAN   ->  HUMAN   [PASS]
  ...
----------------------------------------------------------------------------------
  25 passed, 0 failed  (25 total)
```

---

## Model

`llama-3.3-70b-versatile` — Groq's recommended general-purpose model on the free tier.
Free-tier limits: 30 requests/min, 1 000 requests/day.

---

## Phase 3 — Document generation

`generation.py` takes a legal document template and a user's answers to structured
questions, then calls the LLM to produce a filled draft.

**Compliance constraint:** the model is strictly instructed via the system prompt
to fill in template fields and choose between pre-approved clause variations only.
It must never draft new legal language. This is enforced in code, not just by convention.

**Security properties:**
- All user inputs are validated (required fields, string type, max 500 chars) before
  the API is ever called.
- The prompt is built by string concatenation — Python never processes `{field_name}`
  placeholders in the template body, so user values cannot escape into the prompt structure.
- Errors are caught internally and logged; only a safe generic message is returned to the caller.

**The template** (`EXAMPLE_NDA_TEMPLATE` in `generation.py`) is a placeholder for development.
Real templates must be reviewed by a lawyer. The structure is:

| Key | Purpose |
|---|---|
| `schema` | List of field names the user must supply |
| `body` | Document text with `{field_name}` and `[CLAUSE_VARIATION: name]` slots |
| `clause_variations` | Pre-approved text options for each clause slot |

**Run the tests** (Tests 1–4 are offline; Test 5 calls the API and requires a key in `.env`):

```bash
python test_generation.py
```

Expected output:
```
======================================================================
Test 1 - Missing required fields (offline, no API call)
======================================================================
  [PASS] Missing party_b_name and jurisdiction
  ...
======================================================================
  5 passed, 0 failed  (5 tests run)
```

---

## Phase 4 — Term extraction

`extraction.py` takes clean contract text and extracts key terms into a fixed schema.

**Important:** this module expects plain text as input. It does **not** perform OCR
or parse PDF/Word files — text extraction from documents is handled by a separate
pipeline (not part of this module).

**Input:** a plain-text string (max 30 000 characters, roughly 7 500 tokens).

**Output schema** — six fields, each with an `extracted` value and a `confidence` score (0.0–1.0):

| Field | Description |
|---|---|
| `parties` | All named parties (list) |
| `effective_date` | Date the contract takes effect |
| `contract_value` | Monetary value or payment terms |
| `renewal_terms` | Auto-renewal provisions and opt-out process |
| `termination_terms` | For-cause and for-convenience termination conditions |
| `notice_period` | Required advance notice period |

**Confidence scoring:** fields with confidence below `LOW_CONFIDENCE_THRESHOLD` (default: 0.7)
are listed in `low_confidence_fields` in the return value. These must be surfaced to the
user — they must never be silently presented as certain. Tune the threshold in `extraction.py`
as you review real extraction results.

**Run the tests** (Tests 1–2 are offline; Tests 3–5 call the API and require a key in `.env`):

```bash
python test_extraction.py
```

Expected output (abbreviated):
```
Test 3 - Services agreement (all fields explicit, expect high confidence)
  [PASS] SAMPLE_A: services agreement
       extracted terms:
    parties          conf=0.90  ->  TechStart Solutions Limited, Global Retail PLC
    effective_date   conf=1.00  ->  15 March 2025
    ...

Test 5 - Vague consulting agreement (several fields missing/ambiguous)
  [PASS] SAMPLE_C: vague agreement
       low_confidence_fields : ['effective_date', 'renewal_terms', 'notice_period']
```

---

## Phase 5 — Plain-language clause explainer

`explainer.py` takes a user's question and a specific contract clause, retrieves
the most relevant knowledge base entry using **local embeddings**, then calls the LLM
to explain the clause in plain language.

**Retrieval: fully local, no external embedding API, no paid vector database.**
Uses [sentence-transformers](https://www.sbert.net/) (`all-MiniLM-L6-v2`, ~22 MB)
with cosine similarity. The model downloads once from HuggingFace on first use and
is cached locally. The knowledge base index lives in memory for now.

**Compliance constraint:** the model is explicitly instructed to frame every answer
as general educational information, never as legal advice. Advice-directed phrases
(`"you should"`, `"I recommend"`, `"I advise"`, etc.) are prohibited in the prompt.
The test file scans every answer for these phrases and prints a warning if any are found.

**Two-function API:**

```python
from explainer import EXAMPLE_KB, build_knowledge_base_index, explain_clause

# Build once at startup (loads local model on first call)
kb_index = build_knowledge_base_index(EXAMPLE_KB)

# Call per question
result = explain_clause(
    question        = "What does this notice period clause mean?",
    contract_clause = "Either party may terminate on 60 days written notice...",
    kb_index        = kb_index,
)
# result["cited_source"] tells you which KB entry was sent to the model
```

Return dict keys: `success`, `answer`, `cited_source`, `error`.
`cited_source` is set by the code (the retrieved KB entry topic), not parsed from the
model's answer — it is authoritative regardless of what the model writes.

**Knowledge base entries** are in `EXAMPLE_KB` near the top of `explainer.py`.
Current placeholder entries cover: notice periods, confidentiality/NDA, governing law,
indemnification, and force majeure. Edit the `content` field of any entry to improve
retrieval or explanation quality.

**Run the tests** (Tests 1–2 are offline; Tests 3–5 call the API and embed locally):

```bash
python test_explainer.py
```

---

## Phase 6 — LLM-based guardrail classifier

`guardrail_classifier.py` is the second layer of the guardrail, designed to catch
ambiguous queries that the denylist in `guardrail.py` misses.

**How the two layers work together:**

Every user query passes through both layers in order via `run_guardrail()`:

1. **Layer 1 — denylist** (`guardrail.py`): pure pattern-matching, no API call.
   Catches obvious cases (explicit advice requests, legal action language, etc.)
   immediately and cheaply. If it matches, Layer 2 is never called.

2. **Layer 2 — LLM classifier** (`guardrail_classifier.py`): calls the Groq API
   to classify the query as either `"informational"` (safe for AI) or
   `"specific_advice"` (must go to a human lawyer), with a confidence score.

**Conservative default — the core safety rule:**
Any uncertainty routes to a human. Specifically, `routed_to_human` is `True` if:
- classification is `"specific_advice"`
- confidence is below `CONFIDENCE_THRESHOLD` (even if labelled "informational")
- the API call fails for any reason
- the response cannot be parsed or validated

The function **never** defaults to "safe to answer" on uncertainty.

**The `CONFIDENCE_THRESHOLD` constant:**

```python
# in guardrail_classifier.py, near the top
CONFIDENCE_THRESHOLD = 0.75
```

This is the only value you need to change to tune how conservatively the
classifier behaves. Raise it to send more queries to humans; lower it to let
more reach the AI. Change the number and run `test_guardrail_classifier.py` to
see the effect. No other code changes are needed.

**Usage:**

```python
from guardrail import check_denylist
from guardrail_classifier import run_guardrail

result = run_guardrail(
    query             = "What does a force majeure clause mean?",
    denylist_check_fn = check_denylist,
)

if result["routed_to_human"]:
    # Send to a human lawyer
    print("Route to human. Reason:", result["reason"])
else:
    # Safe to pass to the AI layer (explainer, extraction, etc.)
    print("Pass to AI. Classification:", result["classification"])
```

Return dict keys: `routed_to_human`, `classification`, `confidence`, `reason`, `error`.
The shape is identical regardless of which layer made the decision, so calling
code doesn't need to know whether the denylist or the LLM fired.

**Run the tests** (Section A validation is offline; Sections B Groups 2-3 call the API):

```bash
python test_guardrail_classifier.py
```

The test output includes a manual review checklist. Pay attention to Group 3
(ambiguous queries) — if any slip through as "informational", either add them
to the denylist in `guardrail.py` or refine the few-shot examples near the top
of `_build_prompt()` in `guardrail_classifier.py`.

---

## Project structure (updated)

```
ai-layer/
├── .env.example                  # Template — copy to .env and fill in your key
├── .gitignore                    # Keeps .env and venv out of version control
├── requirements.txt              # Python dependencies
├── guardrail.py                  # Phase 2 — denylist classifier (no API call)
├── guardrail_classifier.py       # Phase 6 — LLM-based secondary classifier
├── generation.py                 # Phase 3 — document generation job
├── extraction.py                 # Phase 4 — term extraction job
├── explainer.py                  # Phase 5 — plain-language clause explainer
├── test_call.py                  # Phase 1 — Groq API smoke-test
├── test_guardrail.py             # Phase 2 — denylist classifier tests
├── test_guardrail_classifier.py  # Phase 6 — LLM classifier tests
├── test_generation.py            # Phase 3 — document generation tests
├── test_extraction.py            # Phase 4 — term extraction tests
├── test_explainer.py             # Phase 5 — clause explainer tests
└── README.md
```

---

## What's next (Phase 7)

- Classification layer: route a user query to the right AI job (explainer,
  extraction, or generation) after the guardrail has cleared it
