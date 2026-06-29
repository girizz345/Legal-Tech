# Template seed data format

Each `*.yaml` file in this directory defines one document template. The seed script
(`app/scripts/seed_templates.py`) upserts each file into the `templates` table, keyed
by `key` (a stable slug), skipping the upsert if the DB already has that `key` at an
equal or newer `version`.

```yaml
key: <stable slug, e.g. "nda">
name: <display name>
version: <int, bump when you change fields or sections>

fields:                       # drives the dynamic form on the frontend.
  - id: <field id, used in Jinja placeholders as {{ field_id }}>
    label: <shown to the user>
    type: text | select | date | number   # no freeform/paragraph type exists — by design
    required: true | false
    options: [a, b, c]        # only for type: select
    min: <number>              # only for type: number
    max: <number>               # only for type: number
    max_length: <int>          # only for type: text — keep short, it's structured input
    help_text: <optional>

sections:                     # the clause bank. Order here is the order rendered.
  - id: <section id>
    title: <heading shown in the rendered document>
    resolution: deterministic | static | llm_classify
    # deterministic: condition_field's value IS the variant id (or maps 1:1 to one)
    condition_field: <field id>            # required when resolution: deterministic
    # llm_classify: a short free-text field gets classified into the closest variant
    source_field: <field id>               # required when resolution: llm_classify, must be type: text
    variants:
      <variant_id>:
        body_template: <Jinja2 string, the actual clause text — placeholder for now>
        plain_note_template: <Jinja2 string, plain-language note shown beside the clause>
    default_variant_id: <must be a key in variants — used on llm_classify fallback or as the sole choice for resolution: static>
```

## Legal-content status

All `body_template` values in this directory are **placeholders**, clearly marked
`[PLACEHOLDER CLAUSE TEXT — NOT LEGAL ADVICE — TO BE REPLACED WITH ADVOCATE-APPROVED
LANGUAGE]`. They exist to prove the generation pipeline works end-to-end (field
substitution, variant selection, rendering, download). **Do not treat any of this text
as real contract language.** Swapping in real, advocate-approved clause text is a pure
content edit to these files — bump `version`, edit `body_template`, re-run the seed
script. No application code needs to change.

Two structural rules are enforced regardless of final wording, because they're about
legal-risk correctness rather than phrasing:
- No section in `offer_letter.yaml` or `founders_agreement.yaml` is allowed to encode a
  post-termination non-competition restraint — these are largely void under Section 27
  of the Indian Contract Act, 1872 (subject to narrow exceptions not applicable here).
  Confidentiality and non-solicitation survive termination instead.
- Every template includes a generic, non-state-specific stamp-duty disclaimer, since
  stamp duty rates and requirements vary by Indian state (Indian Stamp Act, 1899 and
  state amendments) and this app does not calculate or advise on the exact duty owed.
