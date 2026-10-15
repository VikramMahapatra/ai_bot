# Structured datasets v1 implementation

## Delivered

- Dedicated Structured Datasets tabs in Chat Agent create/full edit and management dialogs, separate from document Knowledge Base.
- Reusable manager in the Knowledge Base menu: upload XLSX/CSV or manually create a table; select sheet/header, approve columns/public/queryable fields, preview, save draft, validate, publish, replace with a version, deactivate/delete, and test explicit queries.
- Correct drafts by editing a selected version into a new draft; published versions remain immutable through the supported API. Agent switching aborts stale UI requests.
- Admin-only organization/widget-scoped APIs at `/api/admin/knowledge/datasets`, private-by-default columns, bounded request/import sizes, exact numeric strings, and scoped query validation.
- Additive PostgreSQL JSONB-backed dataset/version/row models and registered migration `2026_10_13_create_structured_datasets`.
- Published versions are selected atomically; failed replacements leave the prior active version intact.
- Chat routing is opt-in. A constrained model plan is validated against the authorized public catalog; code executes exact lookups/ranges/count/sum/min/max without generated SQL or AI arithmetic.
- Structured answers bypass vector retrieval. Explicit company/document requests retain RAG. Mixed requests independently validate a document answer and append it outside the immutable dataset prefix.
- Missing filters, no match, invalid plans, and failures do not become invented dataset values. Streaming and non-streaming use the same routing/execution path.
- Dataset citations are separate from existing knowledge source IDs, returned in optional response metadata and preserved in retrieval trace selected chunks. Plain-text source references work with existing widget clients.
- Existing agent deletion purges only its scoped datasets transactionally. Organization deletion lists dataset dependencies in the existing blocking-data message.

## Safe enablement

The configured database was verified as PostgreSQL 16.15 with JSONB support. No credentials were printed. No explicit migration execution, live dataset write, or feature enablement was performed by the implementation/validation steps.

Settings added to backend configuration:

| Setting | Default | Purpose |
| --- | --- | --- |
| STRUCTURED_DATASETS_ENABLED | false | Global availability / kill switch |
| STRUCTURED_DATASETS_ORGANIZATION_IDS | empty string | Comma-separated pilot organization IDs |
| STRUCTURED_DATASETS_CHAT_ENABLED | false | Separate natural-language chat switch |

Before enabling:

1. Back up the deployment database and verify restore procedures.
2. Rehearse the registered migration on disposable/staging PostgreSQL, including FK creation, reruns, and concurrent publication. Offline DDL checks and SQLite tests do not replace this step.
3. Be aware existing backend startup runs `init_db()`/registered migrations. Deploy/restart is a database-changing action; review the new migration before restart. Existing auto-reload terminals may follow their own startup behavior; this session did not deliberately restart the backend.
4. Enable the global flag and only the intended organization IDs in deployment configuration. Keep chat disabled while importing and checking golden queries through the admin tester.
5. Publish an approved dataset, verify hidden fields, units, required equality filters, and exact results against the source workbook.
6. Complete authenticated create/edit/Knowledge Base workflows and end-to-end chatbot tests. Then enable the separate chat flag for the pilot.
7. Disable chat or the global flag immediately on regression. Added tables and stored versions remain; existing document RAG does not require dataset enablement.

The UI displays an unavailable/opt-in notice while disabled; old agents with no published datasets do not incur a dataset-planner model call.

## Implemented bounds and limitations

- Maximum 2,000 rows/table, 50 columns, 5 MB import/JSON request; 20 query result rows. Maximum 50 datasets and 20,000 stored rows per tenant, including soft-deleted data/history; 10 versions per dataset.
- One selected sheet/table per dataset version. Multiple sheets can be imported as separate datasets. Arbitrary merged-layout inference, joins, XLS files, macros, and formula execution are not supported.
- Formula cells need existing cached results; freshness cannot be verified. Recalculate externally and save values when needed. Numeric formatting/currency is approved through mapping, not inferred as business logic.
- Queries evaluate bounded normalized rows in Python; storage uses PostgreSQL JSONB, but this is not a scalable SQL projection engine. Larger catalogs/imports require a separate indexing/worker milestone.
- Inspection is synchronous and bounded. Original file bytes are not retained, and there is no durable import job queue in this v1; normalized dataset versions are retained.
- Range filters operate on approved numeric/date fields. Client-specific price bands, unit conversions, compound business keys, and cross-row overlap constraints require explicit future schema rules/validation; do not promise automatic pricing-rule interpretation.
- Decimal values never intentionally use binary floating-point arithmetic. Invalid/unsafe values are rejected rather than silently coerced.
- Follow-ups use three scoped prior user questions; no durable pending clarification state. Planner filter values must appear exactly in question evidence. This intentionally favors clarification over guessing, and limits normalization/localization flexibility.
- Mixed document splits must be exact contiguous portions of the current question. Missing/unverified splits show an explicit staged notice instead of invented document details. Mixed streaming buffers the document answer before emitting combined text.
- Exact dataset output labels are not automatically translated; document generation receives the requested language. No unrestricted AI rewrite of numeric output is allowed.
- Published immutability is enforced through service/API/ORM guards, not direct-SQL database triggers. Database access must remain trusted.
- Upstream multipart/body/connection limits and database statement/lock timeouts still require deployment configuration.
- No claim of universal natural-language 100% accuracy. Exact supported executions depend on correct approved source data and validated interpretation.

## Validation evidence

- 87 isolated backend tests passed across `test_structured_datasets`, `test_dataset_chat`, and `test_dataset_cleanup` after mixed composition was completed.
- Coverage includes parsing, leading-zero IDs, decimals, formulas, payload limits, tenant/agent isolation, private fields, publication/immutability, query results/clarifications, routing gates, invalid/truncated planner output, usage, SSE parity, mixed immutable composition, parent deletion, and rollback.
- Additional isolated PostgreSQL validation completed: 23 integration tests passed against a disposable local PostgreSQL 18 cluster, including actual migration reruns/FK repair, JSONB round trips, exact arithmetic, API lifecycle, isolation, rollback, and concurrent publication/version numbering. Combined suite: 110 tests passed. The configured PostgreSQL 16 application database was not changed; version-matched staging validation is still required.
- Frontend Vite production build passed. TypeScript check retains pre-existing errors: HEAD comparison reported 329 baseline vs 328 current diagnostics, with no new diagnostics in the changed dataset files.
- Mocked browser checks passed for the actual agent create/edit/management and Knowledge Base tabs. The real shared manager was also exercised against an isolated PostgreSQL-backed API: CSV import, approval, save/validate/publish, exact lookup/aggregate, replacement, deactivate/reactivate, and delete passed. Test-only auth was overridden within the isolated server; production authentication and a client workbook remain outstanding.
- Real browser testing found blank aggregate result-table cells; result columns now follow returned query fields. Sum, count, and selected-column lookup were re-tested successfully. Frontend production build passed after this fix.
- The isolated API was stopped gracefully, zero temporary test schemas were verified, and the disposable PostgreSQL server was stopped. No real feature flags or credential storage were changed.
- Full application regression and deployment rollout are not certified by isolated tests. Existing external integrations and billing should be exercised on staging before enabling.

## Main integration files

- UI: `frontend/src/components/Admin/StructuredDatasetManager.tsx`, `frontend/src/services/structuredDatasetService.ts`, agent create/management pages, and KnowledgeManager.
- Backend: `app/api/structured_datasets.py`, `app/models/structured_dataset.py`, `app/schemas/structured_dataset.py`, import/query/cleanup services.
- Chat: `app/services/chat/dataset_router.py`, orchestrator, OpenAI planner method, optional chat citations and SSE handling.
- Migration: `app/migrations/m2026_10_13_create_structured_datasets.py` registered in the existing migration list.