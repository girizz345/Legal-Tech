# Schema Notes

Plain-language guide to `schema.sql` for anyone building on top of the AI
layer — written so you can understand every design choice without needing to
read the Python source code.

---

## The two tables at a glance

| Table | What it stores | Produced by |
|---|---|---|
| `contract_terms` | Structured terms extracted from a contract | `extract_terms()` in `extraction.py` |
| `ai_events` | One audit record per guardrail routing decision | `run_guardrail()` in `guardrail_classifier.py` |

---

## `contract_terms`

### What it is

When a user uploads a contract, the AI layer reads the plain text and
extracts six key terms: who the parties are, the effective date, the
contract value, renewal terms, termination terms, and the notice period.
Each extracted field comes with a confidence score (0.0–1.0) indicating
how certain the model was about its extraction.

This table stores those results — one row per extraction run.

### Which Python function writes to it

`extract_terms()` in `extraction.py`. That function returns a dict:

```python
{
    "success": True,
    "terms": {
        "parties":           {"extracted": ["Acme Ltd", "Globex Inc"], "confidence": 0.91},
        "effective_date":    {"extracted": "1 January 2024",           "confidence": 0.95},
        "contract_value":    {"extracted": "$10,000 per month",        "confidence": 0.88},
        "renewal_terms":     {"extracted": "Auto-renews annually...",  "confidence": 0.73},
        "termination_terms": {"extracted": "Either party may...",      "confidence": 0.82},
        "notice_period":     {"extracted": "30 days",                  "confidence": 0.97},
    },
    "low_confidence_fields": ["renewal_terms"],   # fields below threshold 0.7
    "error": None,
}
```

The application layer reads that return value and writes a row to `contract_terms`:

| Dict path | Column |
|---|---|
| `result['terms']['parties']['extracted']` | `parties` (stored as a PostgreSQL text array) |
| `result['terms']['parties']['confidence']` | `parties_confidence` |
| `'parties' in result['low_confidence_fields']` | `parties_low_confidence` (bool) |
| … same pattern for all six fields … | |

### Why `effective_date` is TEXT, not DATE

The extraction model is instructed to copy the date string exactly as it
appears in the document. Legal contracts often use non-standard phrasings
("the 1st day of January 2024", "as of the date last signed below") that
cannot be reliably parsed into a typed DATE column without risk of data
loss or misinterpretation.

### Why `parties` is TEXT[] (not JSON)

The model returns a simple flat list of name strings. PostgreSQL's native
array type (`TEXT[]`) is idiomatic for this — no JSON parsing needed, and
array operators like `@>` work directly for membership queries.

### How `_low_confidence` booleans work

Each field has a `<field>_low_confidence BOOLEAN` column. The threshold
for flagging is defined in `extraction.py` as `LOW_CONFIDENCE_THRESHOLD = 0.7`.

The application layer sets the boolean by checking whether the field name
appeared in `result['low_confidence_fields']`. The boolean records what
was flagged at the time of extraction — if the threshold constant is later
changed in the code, old rows reflect the threshold that was in effect when
they were written.

Rows with any `_low_confidence = TRUE` should be surfaced for human review
before the extracted terms are shown to or acted upon by the user. The
partial index `idx_contract_terms_any_low_confidence` in `schema.sql` makes
this query efficient.

### Placeholder foreign key — `contract_id`

`contract_id` is a UUID that will link this row to the contract it was
extracted from. The `contracts` table does not exist yet. Once it does,
add the constraint:

```sql
ALTER TABLE contract_terms
  ADD CONSTRAINT fk_contract
  FOREIGN KEY (contract_id) REFERENCES contracts(id);
```

Until then, the application must generate a stable UUID for each contract
and use it consistently when writing extraction rows.

### What is NOT stored here

The raw contract text. Contracts contain confidential, often legally
privileged information. Storing it in a plaintext column without encryption
at rest would be a significant security and compliance risk. This table
stores only the AI's structured output — the extracted terms — not the
source document. The document itself should live in a separate, access-
controlled store (a `contracts` table or object storage) with encryption
at rest.

---

## `ai_events`

### What it is

Every query that passes through the guardrail system gets one row in this
table, regardless of outcome. This is the audit trail: it records what the
guardrail decided for every query, why, and with what confidence.

### Which Python function writes to it

`run_guardrail()` in `guardrail_classifier.py`. That function runs two
layers in order:

1. **Layer 1 — denylist** (`guardrail.py`): pure regex pattern-matching,
   no API call. Catches obviously advice-seeking queries (e.g. "should I
   sign this?", "am I liable?"). Fast; no model is involved.

2. **Layer 2 — LLM classifier** (`guardrail_classifier.py`): called only
   if Layer 1 found no match. Sends the query to the LLM (currently
   `llama-3.3-70b-versatile` via Groq) and gets back a classification label
   (`"informational"` or `"specific_advice"`) plus a confidence score.

`run_guardrail()` always returns the same five-key dict:

```python
{
    "routed_to_human": True,           # bool — always set
    "classification":  None,           # str or None
    "confidence":      None,           # float or None
    "reason":          "denylist_match",  # str — always set
    "error":           None,           # str or None
}
```

The application layer writes those values to `ai_events`, plus the model
identifier from `guardrail_classifier.MODEL` (set `model_used = None` when
the denylist made the decision and no model was called).

### What the `classification` column values mean

| Value | Meaning |
|---|---|
| `NULL` | Layer 1 (denylist) fired — no LLM was called. The `reason` column will say `'denylist_match'`. Also NULL if the LLM call failed (conservative default). |
| `'informational'` | LLM classified as a general knowledge question. `routed_to_human` may still be `TRUE` if confidence was below the threshold (0.75). |
| `'specific_advice'` | LLM classified as personal/situational advice. Always `routed_to_human = TRUE`. |
| `'denylist_match'` | Not set by current code — reserved in the CHECK constraint for future use if you prefer an explicit label over NULL for denylist rows. |

### What is NOT stored here

The raw query text. Queries may contain sensitive details about the user's
legal situation (contract terms, employment disputes, etc.). The audit trail
is built from decision metadata only — outcome, classification, confidence,
and the model's one-sentence reason — which is sufficient for reviewing the
guardrail's behaviour without retaining what the user actually typed. This
is consistent with the approach used in the Python code, where internal
loggers record decision metadata and never the query content.

### Placeholder foreign key — `user_id`

`user_id` links the event to the authenticated user who submitted the query.
The `users` table does not exist yet. Every event must have a user owner —
the application layer must populate this from the authenticated session before
writing the row. Once the `users` table exists, add the constraint:

```sql
ALTER TABLE ai_events
  ADD CONSTRAINT fk_user
  FOREIGN KEY (user_id) REFERENCES users(id);
```

---

## Pending foreign keys — summary for Girish

Both placeholder columns are already in place with the correct type
(UUID, NOT NULL). Nothing needs to change in the schema itself — just add
the constraints below once the referenced tables exist.

| When `contracts` table is created | |
|---|---|
| Table | `contract_terms` |
| Column | `contract_id UUID NOT NULL` |
| Add constraint | `ALTER TABLE contract_terms ADD CONSTRAINT fk_contract FOREIGN KEY (contract_id) REFERENCES contracts(id);` |

| When `users` table is created | |
|---|---|
| Table | `ai_events` |
| Column | `user_id UUID NOT NULL` |
| Add constraint | `ALTER TABLE ai_events ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);` |
