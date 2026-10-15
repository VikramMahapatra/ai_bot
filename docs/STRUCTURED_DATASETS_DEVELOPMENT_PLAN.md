# Structured Datasets: Safe Development Plan

Status: bounded v1 implemented behind disabled-by-default feature flags. Migration is registered but has not been explicitly executed against the configured database by this development session. See STRUCTURED_DATASETS_IMPLEMENTATION.md for delivered scope, validation, enablement, and remaining release gates.

## 1. Verified starting point

- On 2026-10-13, a read-only check using backend application settings confirmed PostgreSQL configuration, a live PostgreSQL 16.15 connection, and JSONB support. Credentials and connection URLs were not printed. Deployment environments must be checked independently.
- Reuse the existing PostgreSQL database for structured dataset records; keep ChromaDB for document knowledge.
- The full agent wizard supports both create and edit in `frontend/src/pages/CreateChatAgentPage.tsx`. It saves the agent before knowledge ingestion and tracks `createdWidgetId`.
- `frontend/src/pages/WidgetManagementPage.tsx` has a separate Knowledge Base dialog step, currently providing navigation rather than inline ingestion.
- `frontend/src/components/Admin/KnowledgeManager.tsx` already selects an agent and manages vector knowledge.
- Excel ingestion currently flattens tables to text in `backend/app/utils/parsers.py`. This path must remain backward compatible.
- The active knowledge response path is `backend/app/services/chat/orchestrator.py`, exported through `backend/app/services/chat/__init__.py`. Do not implement the feature only in the legacy `chat_service.py`.
- Schema migrations are registered in `backend/app/migrations/__init__.py`. Startup also contains legacy migration logic; avoid changing the global migration framework in this feature.

## 2. Scope and compatibility contract

First release:

- Import XLSX and CSV; select sheets, header rows, and rectangular table regions.
- Create a small dataset manually by defining columns and entering rows, using the same validation/publishing pipeline as file import.
- Support tenant-defined schemas, exact filters, explicit range matching, sorting, bounded lists, count, sum, min, and max.
- Support company-document questions through existing RAG and mixed questions through both paths.
- Provide draft, validation, publish, update/version, deactivate, and delete workflows.
- Ask clarifications for missing fields, ambiguous datasets, conflicting matches, or ambiguous units.

Not in first release: XLS legacy format, executing macros/formulas, arbitrary SQL, model-written code, cross-dataset joins, automatic interpretation of arbitrary spreadsheet layouts, and customer-specific pricing logic inferred without approval.

Compatibility rules:

1. Preserve existing document upload endpoints, vector records, and default behavior. Do not automatically migrate previously uploaded Excel files.
2. Structured imports are explicit and are not automatically embedded as document knowledge.
3. Add a global kill switch and tenant-level opt-in, both disabled by default. Agents need at least one published dataset before structured routing is attempted.
4. With the feature disabled or no active datasets, do not call the new planner/model. Follow the current chat path unchanged.
5. Preserve appointment, qualification, lead capture, human handoff, commerce routing, authentication, and credit accounting precedence.
6. Preserve existing chat function return shapes during the first integration; use defaulted internal metadata and optional API fields. Do not change all callers unnecessarily.
7. Dataset questions must never silently fall back to an invented vector/LLM price after no match or a structured-query failure.
8. No global chat refactoring, billing redesign, or migration-system replacement in the same release.

## 3. PostgreSQL storage design

Use new shared tables, not a database/table per tenant or per workbook:

| Table | Purpose |
| --- | --- |
| structured_datasets | Non-null organization and widget scope, name, purpose, status, active version, creator, timestamps |
| structured_dataset_versions | Dataset reference, version number, input kind, private file key/checksum, mapping revision, validation report, draft/published status |
| structured_dataset_tables | Version reference, original sheet/table region, approved capability description, required filters, range rules |
| structured_dataset_columns | Table reference, stable key, original header, type, aliases, units, currency, queryable/public flags, allowed operations |
| structured_dataset_rows | Table reference, row number, normalized JSONB values, source sheet/row reference |
| structured_dataset_import_jobs | Scoped durable job state, progress, errors, attempts, idempotency information |
| structured_query_state | Scoped session, validated pending filters, referenced dataset versions, expiry; supports clarification follow-ups |

Design constraints:

- Every access resolves organization/widget ownership, including rows, jobs, versions, and files. Child foreign keys must preserve the parent scope; use scoped/composite constraints where needed rather than relying only on UI checks.
- Versions are immutable after publication. Edits create drafts; publish transactionally swaps the active version while the old one remains available for audits.
- Unique constraints include dataset/version number and table/row number; configured business keys are validated before publish.
- Use JSONB for flexible rows, but normalize numbers/dates at import. Decimal values must not pass through Python/JavaScript floats; store exact decimal representations and use validated NUMERIC casts or typed projections for arithmetic.
- Scope-first B-tree indexes; measured JSONB/expression indexes for approved hot lookup columns. GIN alone does not solve numeric range-query performance.
- Selective data retention: provenance must identify the version used; historical citations should handle later deletion gracefully.
- Integrate agent/organization deletion cleanup explicitly with existing deletion paths, which may not rely on database cascades.
- Original files use private UUID-based tenant-scoped keys, never a bare original filename. Reuse secure private storage where available; introduce an adapter if object storage is not yet configured.
- If SQLite tests remain, run dataset integration tests against PostgreSQL rather than treating SQLite as proof of JSONB behavior. Leave unrelated SQLite code untouched.

## 4. Import and dataset creation pipeline

1. Authenticate admin and verify selected agent belongs to the organization.
2. Create a scoped draft/import job; validate extension, content, compressed size, row/column limits, and subscription entitlement.
3. Inspect workbook without executing content; return bounded sheet/table previews.
4. Suggest column types/aliases, then require tenant approval of mapping, public fields, purpose, and query rules. Private columns are excluded from chat by default.
5. Normalize rows deterministically, preserving identifier leading zeros and distinguishing null from zero.
6. Validate duplicate headers/keys, invalid types, mixed currencies/units, overlapping ranges, required values, and formula cells.
7. Formula cells require valid approved cached values or conversion to values; openpyxl does not recalculate Excel formulas. Missing formula results block relevant publication, not become zero.
8. Show sample normalized results and blocking errors before publish.
9. Publish only a validated mapping revision, atomically activating its version and invalidating scoped catalog/query caches.

Manual creation uses steps 4-9 without a file. Keep the UI bounded for small datasets; large tables use imports. Store jobs in PostgreSQL and use a durable worker/queue, not an in-memory request-local thread dictionary for production. Workers obtain their own sessions and use retry/idempotency safeguards.

## 5. API contract (new endpoints)

Under `/api/admin/knowledge/datasets`:

| Method and path | Purpose |
| --- | --- |
| POST / | Create a dataset draft, including manual creation |
| GET /?widget_id=... | List authorized agent datasets |
| GET /{id} | Metadata, active version, capability summary |
| PATCH /{id} | Update metadata / deactivate |
| POST /{id}/imports | Upload XLSX/CSV into a new draft version |
| GET /imports/{job_id} | Scoped job state, sheet inspection, preview |
| PUT /{id}/versions/{version_id}/mapping | Approved schema and lookup rules |
| PUT /{id}/versions/{version_id}/rows | Bounded manual draft row editing |
| POST /{id}/versions/{version_id}/validate | Validation report |
| POST /{id}/versions/{version_id}/publish | Atomically activate validated version |
| GET /{id}/versions | Version history |
| GET /{id}/rows | Paginated authorized admin preview |
| POST /{id}/test-query | Authorized test with safe trace |
| DELETE /{id} | Disable access and schedule scoped cleanup |

Register static routes before conflicting dynamic routes. Add Pydantic schemas, permissions, pagination, optimistic concurrency for drafts, upload limits, and uniform safe errors. Bind organization from authenticated identity, never from a submitted payload. Public chat does not expose dataset CRUD or raw row browsing.

## 6. One UI implementation in all required entry points

Build shared DatasetManager, DatasetImportWizard, DatasetSchemaEditor, DatasetPreview, and DatasetTestPanel components. They accept a saved widget ID, capabilities, and compact/full display mode; they do not create agents themselves.

| Entry point | Integration |
| --- | --- |
| Chat Agent create wizard | Separate Structured Datasets tab after Knowledge Base; optional, requires saved agent |
| Chat Agent full edit wizard | Separate Structured Datasets tab with shared manager, preloaded for route widget ID, with version/update controls |
| Chat Agent management edit/create dialog | Separate Structured Datasets tab with compact manager; require saved agent before upload/manual draft creation |
| Knowledge Base menu | Add Structured Datasets tab and manager bound to selected agent; preserve current tabs and vector explorer |

Requirements:

- Upload versus manually create choices, schema mapping, preview, validation, and explicit Publish.
- Published versions count toward knowledge readiness separately from embedding counts; structured rows are not labeled vector chunks.
- Selecting another agent cancels/ignores stale requests and resets local state. Uploaded drafts remain scoped to the original agent.
- Feature flags/permissions govern visibility; unauthorized APIs still reject access independently.
- Dataset processing does not modify existing crawl locks or block unrelated document jobs unnecessarily.
- Preserve selected agent when navigating to Knowledge Base; validate the selection on the server.
- All dataset lists use pagination and bounded previews; no full workbook response to the browser.

## 7. Chat integration

Add focused backend modules for import, catalog, plan validation, query execution, deterministic rendering, and follow-up state.

Placement: existing operational API flows first; then add a gated dataset branch to the orchestrator plan builder before vector retrieval. Handle pending dataset clarifications before generic short-message logic where necessary, only for opted-in agents.

Routing:

1. Resolve trusted tenant/agent and active catalog/version snapshot.
2. Interpret original question plus validated follow-up filters. Preserve exact identifiers/numbers even when language translation is used.
3. Produce a constrained `structured`, `vector`, `mixed`, or `clarify` plan using only permitted catalog descriptions and public/queryable column metadata.
4. Revalidate dataset ownership, active/version permissions, allowed fields/operators, value types, units, and cost/result limits in backend code.
5. Run parameterized queries through SQLAlchemy; never execute model-written SQL.
6. Render exact results from approved records with Decimal calculations, units, currencies, and provenance.
7. For mixed questions, assemble immutable structured facts with a separately grounded document explanation; do not let generative wording overwrite dataset facts.
8. Return clear clarification/no-match/unavailable results when appropriate. Retry only within bounded rules; do not disguise a database failure as missing knowledge.

Prefer one planner/executor shared by streaming and non-streaming. Structured text can use the existing token transport without LLM token streaming. Existing streaming code treats `stream is None` as a fallback and may append a handoff offer; distinguish an authoritative dataset result from a fallback so successful lookups do not trigger escalation.

Do not pass deterministic answers through a validator requiring overlap with vector context. Preserve persistence/usage accounting exactly once per request; record planner token usage even when answer generation itself uses no model. Audit WhatsApp and other callers for the same authorization/contract guarantees before enabling those channels.

## 8. Response metadata and observability

- Keep current response text and SSE ready/token/done events.
- Add optional answer_mode and structured citations (dataset/version/table/sheet/row references); do not put dataset IDs into existing KnowledgeSource ID fields.
- Start with readable text answers so older clients continue working; rich table rendering can follow with bounded result metadata.
- Extend widget, dashboard chat, agent test page, and history provenance consistently.
- Log route, validation failures, authorized version, matched row references, latency, planner usage, and result status. Avoid logging raw files, private columns, credentials, or unnecessary personal data.
- Set query timeout, row caps, dataset catalog limits, import quotas, and routing latency budgets.

## 9. Delivery phases and gates

| Phase | Work | Required gate |
| --- | --- | --- |
| 0: Baseline | Inventory callers, preserve uncommitted work, record existing tests/build failures, capture regression cases | Known baseline; no production DB writes |
| 1: Additive storage | Models, registered migration, flags, ownership helpers, private storage, job contracts | Migration succeeds and reruns safely on disposable PG; old app runs with added tables |
| 2: Import/API | File/manual drafts, schema approval, validation, version publish, preview/deletion APIs | Isolation, bad-input, decimals, formulas, concurrency, update tests pass |
| 3: Shared admin UI | Dataset manager in create, full edit, management dialog, Knowledge Base | All four entry points tested; legacy crawl/upload unchanged; builds and type checks pass |
| 4: Read-only query engine | Catalog, planner validation, parameterized lookup/aggregates, deterministic renderer | Client-approved golden answers and no-match/clarification cases pass |
| 5: Gated chat | Shared plan integration, streaming parity, follow-ups, provenance, usage | Existing operational regression suite and compatibility tests pass |
| 6: Pilot and rollout | Staging pilot tenant/agents, metrics, selective enablement | Accuracy, isolation, latency, and rollback criteria met |

Phase 4 initially runs through admin test-query or isolated staging shadow evaluation, not user-visible chat. Shadow evaluation must not charge twice or write duplicate conversations. Enable document-only, structured-only, and mixed cases progressively.

## 10. Test and acceptance matrix

- Tenant A cannot read Tenant B datasets, versions, rows, jobs, files, or caches, including guessed IDs and forged planner output.
- Agent A cannot query Agent B datasets within the same tenant.
- Feature disabled/no datasets produces the previous control flow without an extra model call.
- XLSX/CSV/manual creation, multiple tables/sheets, identifiers, blanks, dates, Decimal values, unit conversions and range boundaries.
- Missing formula caches, merged headings requiring mapping, duplicate keys, conflicting ranges, malformed and oversized files.
- Router false positives/negatives, malicious instructions in headers/cells, private column exfiltration, unknown columns/operators, ambiguous datasets.
- Publish race, mapping revision mismatch, worker retry, concurrent version replacement, rollback to prior version, deletion during reads, stale cache/state invalidation.
- Structured-only agents work without vector chunks; deterministic values remain exact in mixed and translated responses.
- Streaming/non-streaming results, done payloads, citations, and historical attribution agree; aborted streams do not duplicate persistence/accounting.
- Existing handoff, lead capture, appointments, qualification, commerce, credit reservation/refund, document upload and vector chat regressions pass.
- Create/edit wizard and management dialog save guards, selected-agent navigation, agent switching mid-import, responsive layout and permission states.
- Disposable PostgreSQL integration tests; backend unit/API tests; frontend/widget production builds plus separate TypeScript checks (Vite build alone is not type checking).

Acceptance: exact results for an approved supported-query test set, no cross-scope access, safe clarification/no-match behavior, and no new failures relative to baseline. This is not a guarantee of correct interpretation of every possible natural-language question or erroneous source workbook.

## 11. Rollback and release rules

- Take a verified backup and rehearse restore before applying migrations to a deployment database. Migration deployment is explicit and reviewed, not triggered casually by a validation script.
- Deploy additive schema/API first, then flag-hidden UI, then gated routing. Older application versions must tolerate the additional tables/optional fields.
- On regression, disable the feature globally or per tenant; document RAG continues unchanged. Do not drop dataset tables/files during emergency rollback.
- Failed imports never replace the active version. Roll back a dataset by activating a previously validated version and invalidating scope/version caches and pending state.
- Accuracy incident: deactivate the affected dataset/agent capability immediately, retain the trace and version for investigation.
- Before each phase, compare tests against baseline. No destructive changes to current source tables, Chroma collections, client uploads, or existing user edits.

## 12. Immediate next implementation milestone

Next release milestone: rehearse the additive migration and concurrency behavior on disposable PostgreSQL, complete authenticated end-to-end tests using a client-approved workbook, then enable only a pilot organization. Do not enable live routing before these deployment gates pass.