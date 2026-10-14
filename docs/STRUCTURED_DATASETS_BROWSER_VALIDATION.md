# Structured datasets browser validation

## Scope and result

Executed 2026-10-13 against the running Vite UI at http://localhost:5173.
These are browser end-to-end-style checks of the **actual application routes and
React components**, with deterministic intercepted API responses. They are not
live backend, PostgreSQL, importer, authorization, or customer-chat integration tests.
No runtime source files were changed.

The shared page `def51a9f-9e57-4235-8bda-6d1a3dc27204` was inspected using an
accessibility snapshot. It was at `/login`. No passwords were requested, no login
was submitted, and its storage and credentials were not read or modified.
Testing used a separate page, `e6469502-0a4a-4d80-b5ac-55d54bd26773`.

### Safety boundary and exceptions

- A document-local in-memory `localStorage` shim supplied dummy ADMIN identity,
  organization/user 99001, and `browser-mock-not-a-real-token`. This is not a valid
  JWT. Persistent localStorage was never written or cleared. The new page shares
  a browser context, so the shim was essential; merely opening a tab is not
  storage isolation.
- Successful test traffic to every `/api/` endpoint was fulfilled or rejected by
  page-scoped browser interception. Unknown API requests returned a mock 501.
  Non-Vite external resources, including the Meta SDK, were blocked.
- **Setup exception:** the first route handler failed, and a navigation retry
  briefly ran without interception. Unauthenticated API GET requests returned
  401. This was not a zero-live-network run. No live POST, PUT, PATCH, or DELETE
  was made. The handler was repaired before any write controls were exercised.
- A broad temporary mock returned the wrong qualification lookup shape, causing
  `templates.map is not a function`. This was a fixture error, not evidence of a
  regression with the real API contract. The corrected lookup returned an array.
- One unconfigured website crawl status GET,
  `/api/admin/knowledge/crawl/async/latest`, returned mock 501. Website crawling
  was not tested.
- Enabled/disabled capability responses existed only in browser memory. No
  server, organization, feature flag, integration, or production setting changed.
- Cleanup navigated the dedicated page to about:blank, removed its routes, and
  closed it. The shared page was rechecked and remained at `/login` unchanged.

## Actual navigation and controls exercised

### CreateChatAgentPage: create and edit

- Open `/create-chat-agent`: Identity and Conversation tabs visible;
  `04 Structured Datasets` disabled before saving.
- Click **Create Agent and Continue** with no name: required-name error appears.
- Enter `Created Browser Agent`; create: intercepted
  `POST /api/admin/widget/config`, then Conversation UI appears.
- Click **Save conversation setup and continue** without qualification:
  `Please select the template.` appears.
- Select **Fixture qualification** (ID 7), save conversation:
  intercepted PUT to the newly created widget, not a second create POST.
- Knowledge step's **Continue to Structured Datasets** loads capabilities and
  dataset list with the saved widget ID.
- **Continue to Integrations (datasets optional)** works with zero datasets.
  No channel configuration or connection control was submitted.
- Use sidebar **Chat Agents**, then row **Edit**: actual navigation to
  `/widgets/edit/browser_fixture` loads the existing configuration.
- Change Agent Name to `Edited Browser Fixture Agent`; click **Update Agent and
  Continue**: intercepted PUT; Structured Datasets tab loads the existing
  `browser_fixture` scope.

### WidgetManagementPage dialog clarification

The current UI does **not** have an edit dialog: row **Edit** navigates to
CreateChatAgentPage in edit mode. Row **View** opens the **Agent Wizard** dialog.
Both actual surfaces were exercised rather than inventing an edit dialog.

- Row **View**, **Next**, **Next** reaches step 3/5 **Structured Datasets**.
- The dialog renders the actual compact StructuredDatasetManager, with
  **Create dataset**, **Refresh datasets**, and optional-rollout messaging.
- Manual editor: private default, disabled Queryable on private field, invalid
  key error, approval reset after mapping changes, **Make all fields public**,
  **Hide all fields**, **Add column**, **Add row**, and **Cancel** exercised.
- Close dialog using its footer **Close**, not the error alert's Close button.

### KnowledgePage and dataset lifecycle

- Sidebar **Knowledge Base** reaches `/knowledge`, showing separate
  **Document Knowledge** and **Structured Datasets** tabs.
- Select Structured Datasets under `browser_fixture`; **Create dataset**.
- Missing dataset name is rejected locally after approval.
- Select a synthetic CSV file through the actual file input; **Inspect
  fixture-prices.csv** sends intercepted multipart inspection.
- The inspection fixture deliberately declares all returned fields public and
  queryable. The actual UI resets all three to private/nonqueryable:
  checkbox results `[false, false, false]`; Queryable disabled for all three.
- Approve SKU and Price as public/queryable; leave Internal note private.
  Set currency to ` usd `; select SKU as **Required lookup fields**.
- **Correct rows**, edit Row 1, Price; approve mapping/visibility; **Save Draft**.
  Save is disabled before approval and for an uninspected selected file.
- Initial publication disabled; drafts cannot be queried.
- **Validate draft v1** with injected 422: explicit mock error displayed;
  publication remains disabled. Retry: validation passed plus warning displayed.
- **Publish draft v1**, **Cancel**: no publication request. Reopen and
  **Confirm publish**: version 101 becomes active and query tester appears.
- **Run test query** disabled with required SKU empty. Fill `A-01`, run lookup:
  exact decimal string displayed, public-only columns, citations visible.
- Return fields and Filter field dropdowns contain SKU and Price, not Internal
  note. Aggregate field contains Price only.
- Select operations **count**, **sum**, **min**, **max** and run each with mocks.
  Sum disabled until aggregate selected; min/max preserve that selection.
  Result limit input `99` clamps to 20 in requests.
- Injected query 422 displays explicit error and clears the previous result.
- A mocked `no_match` response displays its informational message and zero rows.
- **Replacement from new table** opens a replacement editor; Cancel preserves
  active version. **Edit selected version as new draft** clones v1 with fresh
  approval unchecked. Change Price to `21.0000`, approve, save draft v2.
- Replacement POST leaves active version 101 unchanged; tester remains on v1.
  Validate and explicitly publish v2: active version becomes 102.
- Select historical v1 in **Selected version**: historical preview changes, but
  tester still sends `version_id: 102`, the current active published version.
- **Deactivate** sends inactive status and removes tester; **Activate** restores
  it. Both are mock-only PATCH requests.
- **Delete dataset**, Cancel: no DELETE. Later **Confirm delete** sends mock
  DELETE and displays `Dataset deleted.`
- **Refresh datasets**, **Close details**, and **Manage** exercised.
- Injected save 422 leaves the editor and dataset name intact for correction.
- Injected inspect 422 displays error. A partial inspection (one returned row,
  `row_count: 2001`) displays the silent-row-loss warning; Save remains disabled
  even after approval.
- Agent selector scope change resets selected dataset/query UI; the other
  agent's scope-specific mock list is empty.
- Disabled capabilities: disabled-rollout message, no Create dataset, Document
  Knowledge tab remains accessible. Capability 503: unavailable-rollout message.

## Captured request evidence

The CSV save body contained:

- `widget_id: "browser_fixture"`, `sheet_name: "CSV"`, name `CSV exact prices`.
- SKU text/public/queryable; Price decimal/public/queryable with `currency:
  "USD"`; Internal note private/nonqueryable. Empty unit/currency normalize to
  null rather than empty strings.
- Rows `{sku: "A-01", price: "19.9900", internal_note: "PRIVATE FIXTURE"}` and
  `{sku: "B-02", price: "0.10", internal_note: null}`.
- `required_filters: ["sku"]`.

Lookup request: dataset 1/version 101, operation lookup, filter SKU eq `A-01`,
select `["sku", "price"]`, limit 10. Count/aggregate requests used select `[]`,
limit 20; sum/min/max used aggregate column `price`. Replacement preserved the
private column, null, and `0.10`; edited price was the exact string `21.0000`.
Historical-preview lookup still used active version 102.

The query mock intentionally returned static results, including `19.9900` even
after v2 and a generic aggregate response. Therefore these checks establish UI
display/payload behavior, **not arithmetic or query correctness**.

## Browser evidence

Accessibility snapshots captured actual tab labels, disabled controls,
validation errors, draft notices, public result table, citations, replacement
history, and unavailable messages. Screenshots were returned in the browser
session for:

1. Actual WidgetManagementPage Agent Wizard, Structured Datasets step 3/5.
2. Authorized query tester: `matched: Exact price: 19.9900`, SKU/Price only,
   citation dataset 1/version 101/row 1.
3. KnowledgePage structured dataset unavailable-rollout message.

Screenshots are conversation artifacts, not checked-in image files.

## Reproduction checklist and fixture contract

1. Start the existing Vite UI separately; inspect the shared page without reading
   tokens. Do not submit real login credentials. Prefer a fresh browser context;
   otherwise install the document-local storage shim before loading actual App.
2. Before navigation install a fail-closed `page.route('**/*', ...)`: intercept
   every API host/path, including OPTIONS, record only fixture bodies, allow
   only localhost Vite GET/HEAD resources, abort everything else. On handler
   exceptions fulfill a mock error instead of leaving requests pending.
3. Fixture auth: `/api/admin/me` ADMIN profile, `/api/admin/features` `{}`,
   `/api/organizations/feature-access` allowed response, credits summary with
   remaining 10000. Qualification lookup returns an array; list returns items.
4. Widget list and organization widget list return `{widgets, pagination}`;
   include existing `browser_fixture` and persist newly created widgets only in
   memory. Config POST/PUT update memory; config GET returns the matching widget.
5. Dataset base: `/api/admin/knowledge/datasets`. Capabilities returns enabled
   true, chat_enabled false, formats csv/xlsx, max rows 2000/max columns 50.
   List returns scope-filtered `{items}`. Detail returns dataset with versions.
6. Inspect returns CSV columns/rows described above. Create returns dataset 1,
   draft 101; replacement returns draft 102. Validate returns valid/errors/
   warnings; publish updates in-memory active_version_id/status; PATCH toggles
   in-memory status; DELETE removes from memory. Test-query returns deterministic
   matched/no_match results with public-only rows and citations.
7. Execute the controls above at viewport 1440x1000, asserting request bodies and
   visible/disabled controls. Smaller initial viewport prevented reliable clicks
   on the Identity action; resizing resolved the automation issue.
8. Inject one-shot 422 for inspect/save/validate/query, capability 503, disabled
   capabilities, and incomplete inspection. Never change real feature flags.
9. Finish on about:blank; remove routes and initialization scripts or close the
   dedicated page. Never clear or overwrite shared persistent storage.

## Not covered / blocked

- Real authenticated role/organization authorization and live rollout state:
  shared page was logged out; user must log in independently for live access.
- Real CSV/XLSX parsing, file security, database persistence, SQL execution,
  decimal aggregation accuracy, citations from real rows, and concurrent/stale
  response behavior. These require separate disposable-backend tests.
- Customer-chat structured answers, natural-language query interpretation,
  embeddings/crawl, credit accounting, WhatsApp, email delivery, production
  integrations, workbook sheet switching, 50/2000-row pagination boundaries,
  and mobile layout. No real flags or integrations were enabled.
- Structured HTTP failure branches were tested, but every possible schema error,
  publish/status failure, and query clarification branch was not.

No product bug requiring a runtime edit was established by these mocked checks.

## 2026-10-13 — Real manager lifecycle with isolated API and disposable PG18

### Scope and safety

This additional run exercised the actual shared StructuredDatasetManager and
structuredDatasetService through Vite imports, connected to the already-running
isolated API at http://127.0.0.1:55440. Dataset endpoints were **not mocked**.
The existing dataset_browser_test_server wrapper reuses the PostgreSQL fixture's
real route/service registration, request sessions and commits; its fixture checks
PG18 and owns a unique disposable schema. Database/server disposal remains the
parent's responsibility; no servers were stopped by this browser run.

Before mounting, GET `/test-context` returned `disposable: true`, organization 1,
user 1, ADMIN, widgets `agent-a`/`agent-b`, and the dataset API prefix. It was
checked again from the mounted page. ADMIN authentication is overridden only
inside that isolated server; no production authentication or model calls occurred.

Dedicated page `051d5784-1e6f-4c44-ba57-c875fb78e5ab` was created, not the shared
login page. A document-only response supplied a blank Vite-origin harness at
http://localhost:5173/isolated-dataset-manager-harness, then `page.setContent`
supplied the React root. The application router/login was never mounted.
The actual axios instance's `defaults.baseURL` was set to the isolated origin
before rendering the manager with `widgetId: "agent-a"`. A page-scoped API guard
continued real requests only to port 55440 and aborted other `/api/` destinations.
The original application backend received no writes from this run.

No localStorage credentials were changed or inspected, and no auth shim was
installed. The existing axios interceptor was left intact. The shared page was
not touched. Only this documentation file was edited; runtime files were not.

### Browser execution and persisted results

The CSV contained header `code,price,secret` and rows `001,0.10,hidden` and
`002,0.20,internal`. Real multipart inspection preserved leading-zero codes and
exact decimal strings, inferred price as decimal, and returned the private-default
approval warning. All three Public checkboxes were unchecked and all three
Queryable checkboxes disabled. Code and price were explicitly made public and
queryable; secret stayed private/nonqueryable. Price currency entered as ` usd `
persisted as `USD`; no required lookup filters were selected (`[]`).

| Actual control / verification | Real result |
| --- | --- |
| Save Draft | Dataset ID 1, draft version ID 1/v1, two rows; status draft, active pointer null |
| Validate draft v1 | Validation passed, no errors or warnings |
| Publish draft v1, Confirm publish | Active status, active_version_id 1 |
| Lookup: price eq string `0.10`, select code/price | HTTP 200, one match: code `001`, price `0.10`; response includes `0.10 USD` |
| Lookup: price eq string `9.99` | HTTP 200, no_match, zero matches, empty rows and citations |
| Sum: price, no filters, select [] | HTTP 200, exact string `0.30`, USD, two matches |
| Edit selected version as new draft; change Row 1 price to `0.15`; approve/save | HTTP 201, draft ID 2/v2; active pointer remains 1 |
| Run tester while replacement is draft | Sends version_id 1; still returns `001/0.10` and `002/0.20`, not the draft price |
| Validate v2; Publish v2, Confirm publish | HTTP 200, valid; active pointer changes to 2 only after explicit publication |
| Published v2 lookup | HTTP 200, public-only `001/0.15` and `002/0.20` |
| Deactivate | HTTP 200, inactive with pointer 2 retained; Authorized query tester absent |
| Activate; run sum again | HTTP 200, active pointer 2; exact string `0.35 USD`, two matches |
| Select historical v1 and run sum | Historical preview shows `0.10`; tester still sends version_id 2 and returns `0.35 USD` |
| Delete dataset, Confirm delete | HTTP 200; UI shows Dataset deleted and zero datasets |
| Independent GET detail/list after deletion | Detail HTTP 404, Dataset not found; agent-a list items [] |

Create/replacement already returned valid server validation reports, so Publish
was enabled after save; explicit Validate controls were nevertheless exercised.
There was no deliberately failing query on an inactive dataset: unavailability
was established by persisted inactive status and removal of the tester.

Independent isolated API GETs confirmed database-backed detail and `/1/rows`:
before v2 publication the active rows still held `0.10`/`0.20`; after publication
they held `0.15`/`0.20`. Detail retained both published historical versions with
their original rows. Admin detail/rows appropriately include the private secret
values; every actual query response omitted secret from rows and response text.
Filter-field choices contained only code/price and Aggregate field only price.

Lookup citations were dataset 1/version 1/sheet CSV/row_numbers [1]. Initial sum
citations were dataset 1/version 1/rows [1,2]. Published v2 lookup, reactivated sum
and historical-preview sum cited dataset 1/version 2/CSV/rows [1,2]. These came
from real query responses, not static browser fixtures.

### Reproduced UI issue and harness errors

**Aggregate preview schema mismatch:** the real sum API returns a row shaped
`{operation: "sum", column: "price", value: "0.30", unit: null, currency: "USD"}`.
QueryTester renders RowPreview using the source public columns code/price,
therefore the aggregate result table displays one row of blank cells. The alert
correctly displays `0.30 USD` (and later `0.35 USD`), match count and citations.
This is a reproduced UI presentation issue, not an arithmetic or persistence
failure. It is reported without changing runtime source, as requested.

Harness setup errors were recovered before dataset writes: the initial broad
navigation guard timed out; a narrow document handler succeeded. Vite required
its React-refresh preamble and default exports from prebundled React/ReactDOM.
The browser automation sandbox did not expose Node Buffer/TextEncoder;
setInputFiles attempts with a Uint8Array were rejected because Playwright requires
Buffer. Instead, an in-memory browser File/DataTransfer was assigned to the actual
file input and its change event dispatched. This still exercised the real React
upload handler, multipart request and backend CSV importer, but **was not a
successful Playwright setInputFiles-buffer upload**. No disk fixture was created.
The intentional post-delete detail GET produced an expected 404 console entry.

### Evidence, cleanup and limits

Accessibility snapshots recorded private defaults, imported values, persisted
version history, old-active/new-draft distinction, public query results, exact
aggregates, inactive tester removal, reactivation and final empty list.
Screenshots returned as conversation artifacts show:

1. Real v1 exact lookup, `0.10 USD`, public-only table and row-1 citation.
2. Real v1 sum, `0.30 USD`, rows [1,2] citation and blank aggregate preview cells.
3. Final Dataset deleted / zero datasets state.

Cleanup navigated this dedicated page to about:blank, removed its page-scoped
routes and called page.close. The automation wrapper then reported the page ID
not found when attempting its post-close snapshot. No shared tab was closed and
no parent-owned API, Vite or PostgreSQL server was stopped.

This adds actual CSV import, UI-to-API lifecycle, database-backed version/row
persistence, exact decimal sums and real citations to the earlier mocked checks.
Full authenticated agent-tab navigation remains covered only by the earlier
mocks; real login, production authorization/rollout, customer chat/model calls,
XLSX, optional long-decimal manual entry and concurrency were not tested here.
The earlier mocked-run limitations remain historical statements for that run,
not a claim that persistence/arithmetic remain untested after this addition.

## 2026-10-13 — Correction: result-column regression re-test passed

**The aggregate preview schema mismatch reported above is superseded by this
successful re-test of the parent's runtime fix.** QueryTester now derives
`resultColumns` from the returned first row's keys, retains source labels for
returned source fields, and supplies labels for aggregate keys. The earlier
blank-table observation remains historical evidence, not a current open issue.
No runtime files were edited during this re-test.

### Actual manager, isolated backend, and reproducible setup

- New dedicated browser page `82bd9b0d-251f-408d-86be-71831becc9d4`; document-only
  harness at http://localhost:5173/isolated-dataset-result-correction. The app
  router/login was not mounted. No on-disk harness was created.
- Before any dataset write, real GET `/test-context` confirmed `disposable:
  true`, ADMIN organization/user 1 and `agent-a`; GET `/` reported
  `postgres_major: 18`. The already-running isolated API was
  http://127.0.0.1:55440; its parent-owned disposable PostgreSQL fixture and
  servers were left running.
- Install a narrow document route returning an HTML `root` element, plus an
  `/api/` guard that continues only the isolated dataset prefix and aborts all
  other API destinations. Dataset endpoints are never fulfilled with mocks.
  An initial broad navigation handler timed out before seeding; removing it and
  installing the narrow routes recovered the harness.
- Replace only this document's `localStorage` property with a memory shim:
  `getItem` returns null; writes throw. No persistent credentials were read or
  changed. The isolated server's existing dummy ADMIN override handled auth.
- Seed with browser `fetch` to the isolated dataset API. Initialize the Vite
  React-refresh preamble from `/@react-refresh`, import the default exports of
  `/node_modules/.vite/deps/react.js` and
  `/node_modules/.vite/deps/react-dom_client.js`, and import the actual
  `/src/services/api.ts`. Set its axios `defaults.baseURL` to the isolated origin
  before importing and rendering the actual
  `/src/components/Admin/StructuredDatasetManager.tsx` with
  `widgetId: "agent-a"`. A response observer records real test-query responses;
  it does not replace them. Use viewport 1440x1000.

Seed POST `/api/admin/knowledge/datasets/` returned **201**, dataset **2**,
draft version **3/v1**. Name: `Browser resultColumns correction 2026-10-13`;
sheet: `Manual`. Columns: `code`/Code, text; `price`/Price, decimal with currency
`USD`; both public/queryable, aliases `[]`, unit null. Rows were exact strings
`{code: "001", price: "0.1"}` and `{code: "002", price: "0.2"}`;
`required_filters: []`. POST `/2/versions/3/publish` returned **200**, active
pointer **3**. Persisted published rows retained those exact strings.

### Assertions against the rendered result tables

Click **Manage** for the existing seeded dataset, then operate the actual
Authorized query tester. All three test-query requests returned **HTTP 200**,
dataset 2/version 3, empty filters, limit 10, and two matches. Assertions target
the tester's result table, not the separate source-version preview or alert.

| Actual controls and request | Backend rows | Asserted rendered table |
| --- | --- | --- |
| Operation **sum**, Aggregate field **Price**, Run test query; `select: []`, `aggregate_column: "price"` | `[{operation: "sum", column: "price", value: "0.3", unit: null, currency: "USD"}]` | Headers exactly **Operation, Column, Value, Unit, Currency**; cells exactly `sum`, `price`, `0.3`, empty unit, `USD` |
| Operation **count**, Run test query; `select: []` | `[{count: 2}]` | Only header **Count**, cell **2** |
| Operation **lookup**, Return fields: deselect **Code**, retain **Price**, Run test query; `select: ["price"]` | `[{price: "0.1"}, {price: "0.2"}]` | Only header **Price**, cells **0.1** and **0.2**; no misleading unreturned **Code** header/cells |

The sum assertion checked the backend value's JavaScript type was `string`,
accepted only `"0.3"` or `"0.30"`, and required the **Value cell to equal that
actual backend string exactly**. This run returned/rendered `"0.3"`, not
`"0.30"`. All three table assertions passed. Real citations referenced dataset
2/version 3/sheet Manual/row_numbers `[1,2]`.

### Cleanup and corrected conclusion

Actual **Delete dataset → Confirm delete** returned **200** and displayed
`Dataset deleted.` Independent isolated GET `/2` returned **404**, `Dataset not
found`; GET list for `agent-a` returned **200**, `items: []`. Exactly three real
tester queries were captured. The React root was unmounted, the dedicated page
navigated to about:blank, routes removed, and `page.close()` called. As in the
previous run, the wrapper's post-close snapshot reported the page ID not found.
No shared tab was closed, no production writes were made, and no parent server
was stopped. Only this documentation file was changed by the re-test.

**Result: the original aggregate-table issue is fixed and superseded; count and
selected-field lookup rendering also pass against the real isolated PG18 API.**
This correction does not extend coverage to production auth, full agent-page
navigation, customer chat, or other operations not exercised in this re-test.