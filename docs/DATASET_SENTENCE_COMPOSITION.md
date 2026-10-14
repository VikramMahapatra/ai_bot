# Dataset answers: prompt-driven templates and independent grounding review

## Production boundary

The router owns planning, scoped execution, answer composition and verification.
Its public route API and `ChatResponsePlan` contract are unchanged. The
orchestrator forwards generic document decisions and persists context/reset
markers alongside document citations. Streaming and non-streaming receive
the same final `override_response` / `grounded_fallback`; an unverified candidate
must never be streamed. No rows enter the planner, and neither assistant history
nor untrusted executor response prose establishes facts.

The old English scope parser, sentence-choice grammar and tone menu are removed.
The agent's actual configuration controls tone, language and relevant explicit
business scope. There is no service-vocabulary regex or per-domain routing code.

## Pipeline and structured protocol

1. The planner chooses metadata, structured, mixed, vector or clarification using
   the existing strict route schemas and tenant-scoped public catalog.
2. A structured query is constrained, filter-grounded, resolved, version-pinned
   and executed by the existing service. `_result_facts` validates **every**
   projected lookup row, not just the facts the writer ultimately selects.
   Numeric values must be exact encodings, not floats. Aggregates must preserve
   operation, field, unit and currency. No arithmetic is delegated to the model.
3. `generate_structured_answer` generates a natural-language **template** with
   free prose, relevant fact selection, ordering and prompt-driven tone. Its
   standard envelope contains exactly `answered`, `confidence`,
   `requires_escalation` and `response`. Insufficient evidence means
   `answered=false`; the router uses its deterministic fallback.
4. Mechanical checks validate the envelope, template size, known unique markers,
   required query limitations, at least one result value for matched rows, and
   absence of numeric characters outside authorized markers. Unknown/malformed
   markers and copied numeric literals are rejected before verification.
5. A single substitution pass expands opaque values. There is no recursive
   expansion of placeholder-shaped stored text.
6. A **fresh, independent** `generate_structured_answer` call reviews the fully
   substituted candidate. It receives the question, all authorized facts,
   referent-only context and the trusted agent prompt, not generator confidence
   or generator reasoning. Its standard envelope must have `answered=true` and
   `response="supported"`. False/unsupported/malformed/error verdicts fail closed.
7. Only an accepted candidate is exposed. Rejection returns deterministic result
   sentences retaining subjects and query filters, or scope uncertainty for
   metadata. Configuration text is never a deterministic fallback or quote.

## Trust and semantic rules

Both answer completions receive three distinct messages: system grounding rules,
a separate system message containing trusted scoped agent configuration (subject
to those rules), then a user message containing **untrusted reference data**.
Public descriptions, stored values, questions and the candidate are never
instructions. Administrator configuration cannot override the grounding protocol.

The writer and verifier are instructed to:

- Naturally paraphrase relevant public business scope, not echo all configuration
  or reveal internal instructions, prompts, contact workflows or escalation rules.
- Require support for every factual claim, including subject/value associations,
  currency, units, quantifiers, conditions and polarity.
- Treat a negative service exclusion as supported **only** by an explicit matching
  configuration statement. Missing evidence is unknown, never denial.
- Preserve the actual service: advice about a service is not provision of it.
  Do not pivot unknown requests to another service or invent current availability.
- Treat dataset names, descriptions and column types as information about data,
  not proof of offerings. Query no-match is not a business exclusion.
- Never rely on the user's asserted prices, availability or other factual claims.

## Exact value slots and honest limitations

Each complete formatted field value is one immutable atom, for example
`USD 123,456,789.12345678900 per cycle`, not separate currency/number/unit slots.
Dates, counts and numeric-looking subjects, labels and filter referents are also
opaque. Markers use alphabetic identifiers such as `[[VALUE_a]]`. Numeric checks
cover Unicode numeric characters, including superscripts and fractions, not just
ASCII digits. A template cannot copy even an authorized amount as literal prose.

Mechanical checks guarantee exact inserted value bytes and prohibit new numeric
characters outside slots. Numeric literals cannot straddle slot boundaries, so
prose cannot add a sign or concatenate separate slots into a new numeral.
They do **not** prove correct associations, relevance,
polarity or entailment. Written-out number claims, added currency/unit words,
misassociated legitimate values, service changes and instruction leaks are
reviewed by the independent verifier. That review is **probabilistic**, can make
errors, and is not a semantic guarantee or validation of administrator truth.
No lexical-similarity threshold is used as an entailment proof.

Configuration-only numeric claims without an authorized metadata/result value
slot fail closed: the router does not mine arbitrary prompt numbers or internal
workflow text into output slots. Numeric business data that must be answered
should be published as scoped facts with complete formatted units/currency.
The shared transport requires response text to start as prose, not an array,
object or code fence; generation guidance preserves that existing contract.

## Metadata follow-ups

Scoped context is stored in the existing retrieval-trace selected-chunks JSON;
no database migration is required. Only the latest organization/widget/session
trace is read. Query context is revalidated against the active public catalog
and version; a reset or invalid context is a barrier, never a reason to search
older traces. Twelve recent scoped user questions inform planning. A filter
absent from the current question requires explicit `carry_filters` matching the
validated previous query; historical literal occurrence alone is not permission
to reuse an old value for a new request.

`MetadataRoute.carry_context` is a strict boolean, default **false**. For a
referential metadata follow-up the planner explicitly sets true. The router
revalidates the latest prior query against the current scoped catalog and text
filter resolver, rejects any change, and supplies only its dataset/version and
filters as referent, never old rows. It retains the query marker and history floor
for subsequent structured follow-ups. Metadata descriptions/schema need no prior
SELECT re-execution and cannot establish record attributes.

Explicit current scope/new-topic metadata uses false and resets context. Invalid,
stale, foreign or missing carried context fails closed, never reviving an older
trace. An item-attribute question such as “is it that type?” must instead produce
a fresh structured SELECT when that column exists, with explicit `carry_filters`.

## Accounting and tests

A normal accepted dataset answer now uses one planning completion, one writing
completion and one verification completion. This adds latency and provider cost
compared with the removed fixed-format shortcuts. All three are counted. Mixed
answers may add an independent document completion. Mixed document grounding
uses the same checks as standalone document answers, including when the dataset
portion has no match.

Planner, generation and verifier usage are accumulated, including declined or
malformed envelopes, rejected candidates and provider exceptions exposing
`token_usage`. Rejection never refunds consumed completion usage.

The generic suites exercise the actual router, schemas and shared completion
parser with scoped in-memory history and independently mocked writer/verifier
responses. They cover multilingual/multi-domain free prose, exact amounts,
projection validation, unknown denials, conditions, changed services, internal
leaks, public injection, token accounting and metadata context continuity. These
are protocol/fail-closed regression tests, **not** a live-model semantic accuracy
benchmark. They neither contact a provider nor alter a persistent database.

The combined ten-module regression run passes 263 tests, including updated
legacy chat contracts, stream/non-stream and persistence integration, real
SQLite dataset execution, exact filter resolution and dataset API checks.

## Configuring an agent

Keep public business scope, any explicit exclusions, desired tone and interaction
instructions in the existing agent system-prompt editor. No fixed English clause
format is required. Give datasets meaningful names/descriptions and columns
clear labels/aliases; publish factual units and currency instead of asking the
model to infer them. Supported services are not inferred merely because a
dataset exists, and absent information is not treated as a business refusal.

## Live clarification recheck — 2026-10-14

The reported repeated city/area reply was persisted by a backend started at
03:44 without reload, before the generic refactor. Restarting exposed a second
problem: model clarification decisions were replaced with a generic question,
and declined clarification writers repeated that same fallback. Clarification
now uses a scoped writer/verifier, retains the latest resetting user question,
and permits a direct evidence-limit answer when the requested type is clear.
No per-agent keywords or stored prompt changes were introduced.

After loading the final source, a fresh session replay through the authenticated
application client returned HTTP 200 for both original messages. The second
message, “residential in kharadi pune”, returned: “I cannot confirm details about
residential rental spaces in Kharadi, Pune.” It did not ask for the already
supplied location or quote unrelated office prices. The first reply described
the configured aggregator role but also offered information about “available
coworking spaces”; that wording is not proof of actual inventory. The semantic
verifier remains probabilistic and this recheck is not full conversational
acceptance certification.

The saved agent prompt does not explicitly exclude residential rentals. A
definite business denial therefore still requires an explicit administrator
scope statement or authorized knowledge evidence, not additional platform code.