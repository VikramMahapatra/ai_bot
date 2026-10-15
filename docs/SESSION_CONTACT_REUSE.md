# Widget session contact reuse

Successful Quick Connect submissions retain name, email, phone, company and configured
custom fields. Meeting forms show only missing (or invalid) contact fields. Booking and
human handoff reuse the same session data; a handoff-to-bot transition does not reset it.

## Scope and privacy

- Embedded widget contact data is stored in `sessionStorage`, keyed by API origin,
  widget ID and session ID. No contact PII is added to `localStorage`.
- The public agent preview uses the same isolation policy with its existing test-session
  context. Contact values restore on reload only within the live session.
- Existing 120-second inactivity rules expire contact context. New chat and widget
  changes clear contact/form state. Expired reloads rotate the session ID. Failed or late
  submissions cannot populate a new session.
- Backend contact context uses the existing bounded 120-second chat cache. Active
  requests renew that TTL. Cache misses recover Lead and Quick Connect conversation
  records only by exact organization, widget and session, never by matching another
  visitor's email or phone.
- Existing Lead/contact record retention is unchanged. Clearing transient contact
  context does not delete business records; a new session cannot recover the old
  session's records.
- Cached contact values are marked as untrusted visitor data, not document evidence
  or instructions. Booking success still requires the booking workflow to complete.

## Regression coverage

From the widget directory, `npm test` runs cache/SSE/field-message tests and `npm run test:browser`
builds the bundle and runs the browser tests. The browser runner uses Microsoft Edge;
all API traffic is mocked, with no live bookings, notifications or credits consumed.

From the backend directory, run the `test_session_contact_reuse` unittest module for
scoped SQLite/cache, submission, handoff and conversational/direct-booking regressions.
These tests extract production definitions without importing startup/Chroma services.

## Handoff status and form transcript persistence

- Embedded chat displays a live header status and expandable banner for waiting and
  assigned handoffs. Both SSE completion metadata and non-stream response metadata
  activate it; a missing UI action does not discard an authoritative chat/status pair.
- SSE parsing handles chunk boundaries, CRLF and a final event without a blank line.
  The embedded widget reconciles the scoped session endpoint every 1.5 seconds while
  open, including when a stream disconnects before delivering its completion event.
  Admin acceptance is therefore visible without another visitor message. Existing
  tenant-scoped admin websocket delivery remains separate from visitor polling.
- Backend SSE generators run in a worker pool. Handoff broadcasts now execute on the
  async request loop after the handoff transaction commits, not via `create_task` in
  a worker without a running event loop. Disabled human handoff cannot falsely report
  a successful connection. Active human conversations pause bot inactivity expiry.
- Quick Connect stores one user-only Conversation record for the entire submission,
  with exact tenant/user/widget/session scope, `source=quick_connect`, and an empty
  response: `Quick Connect Details: Name: ... | Email: ... | Phone: ... | Company: ...`.
  Every custom field is included in the same message with its exact key and typed
  JSON value. Delimiter-bearing values are quoted to preserve pipes, colons and
  newlines. No schema migration is required; legacy per-field recovery still works.
- Matching scoped whole submissions reuse existing records. Changed submissions
  create one new record. Submitting a previous snapshot refreshes its timestamp so
  contact recovery honors the latest submission without duplicating that snapshot.
- Lead, contact, credit, usage and transcript staging finish before the successful
  submission commit. Failed submissions do not cache data or append form transcript
  entries. The existing message-persistence function is reused; transaction-only
  lead bookkeeping avoids legacy helpers that commit partway through submission.
- Empty form responses are omitted from AI messages. Previous-assistant lookups skip
  form entries, retaining escalation/booking context. All successful submitted fields
  also appear immediately as one deduplicated user message in both widget surfaces.

## Handoff duplicate prevention

- Handoff creation inserts its acknowledgement only inside the scoped, idempotent
  creation path. The internal direct-request reason stays in admin audit data, not
  a visitor-facing bot message.
- Normal visitor followups during a waiting/assigned handoff return status metadata
  without repeating the initial acknowledgement. Genuine user turns are still kept.
- Request-triggered timeout/booking replies are delivered through chat/SSE. Their
  ID-linked delivery audits suppress polling replay while preserving the admin bot
  transcript. Poll-triggered timeout messages remain delivered through polling.
- Both widget surfaces preserve seen event IDs across repeated loads of the same
  handoff, omit internal audit text, and do not turn empty status-only responses into
  fabricated acknowledgements or error bubbles. Agent messages remain visible once.

Additional backend regression modules: `test_quick_connect_persistence` (real SQL
columns/SQLite, isolated ASGI submission/history) and `test_handoff_event_delivery`
(actual SSE worker iteration, tenant hub delivery, admin acceptance and visitor polling).