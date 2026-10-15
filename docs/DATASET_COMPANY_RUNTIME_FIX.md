# Pricing and company-document runtime regression verification

## Observed evidence

- Existing conversations 1910 and 1912 retrieved source 81. Their reconstructed
  retrieval confidence was 0.3884 / 0.3915: generation was already permitted.
- A real OpenAI replay returned `answered=false` for unconfirmed city coverage.
  The old validator/finalizer converted this explicit evidence limit into generic
  clarification. Another replay treated the user-facing widget name as an unknown
  company, despite retrieving the company document.
- Conversation 1913 asked for the area already present in the current pricing
  question. A missing-filter planner path can produce this result even when the
  exact public city/location pair exists in the published data.

## Generic fixes

- Before model planning, explicitly requested prices can use a bounded, scoped,
  version-pinned exact lookup. Each public required text value must independently
  match normalized words from the current question, coexist in an actual record,
  and identify exactly one dataset across the scoped catalog.
- Conflicts, absent evidence, inequalities, numeric filters, aggregates, compound
  document questions and explicit other-column requests retain the normal planner.
  Scanned rows never enter a model prompt; only authorized price columns are returned.
- Company introduction generation can rewrite a subject matching the scoped widget
  name into a company-overview request. It does not assert a legal brand alias or
  rewrite unrelated brands. Retrieval confidence is not raised or bypassed.
- Company completions require normal validator acceptance, `answered=true`,
  similarity at least 0.1, no escalation, and exact numeric evidence. Unanswered or
  rejected completions yield an explicit knowledge-base limit, not a document copy
  or generic clarification. Streaming buffers these answers before validation.
- Bare clarification after a company question asks about company details rather
  than dataset city/area. The obsolete mixed-answer notice assertion is corrected.

## Verification

- Read-only PostgreSQL replay of the real catalog and executor returned the
  published Gota/Ahmedabad range: INR 5000.0–9000.0 per seat, dataset 1, version 1,
  row 1, with zero planner calls. No billing period was inferred.
- The actual company document and scoped widget configuration produced a real
  accepted OpenAI introduction: `answered=true`, confidence 0.87, similarity 0.868.
- Unconfirmed Pune coverage returned an explicit city-coverage evidence limit.
- Missing-area pricing still asked “Which area are you interested in?”
- Focused router, resolution, company, dataset and cleanup suites passed: 133 tests.
- Application DB access used read-only transactions; no chat persistence, migration,
  credit writes or persistent Chroma initialization was performed during replay.
- The existing non-reloading server was not restarted. HTTP verification of the
  updated code remains pending a controlled parent/server restart.