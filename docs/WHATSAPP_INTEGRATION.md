# WhatsApp Cloud API Integration (Meta)

This project now supports organization-level WhatsApp integration with plan gating.

## What was added

- `whatsapp_enabled` feature flag in plan and organization limits.
- Organization-scoped WhatsApp channel config storage.
- Admin APIs for configuration and test send.
- Public webhook endpoints for Meta verification and incoming messages.
- Incoming WhatsApp messages routed through existing chat engine and persisted in conversations.

## New endpoints

### Admin endpoints (requires admin token)

- `GET /api/admin/whatsapp/config`
- `PUT /api/admin/whatsapp/config`
- `POST /api/admin/whatsapp/test-message`

### Webhook endpoints (for Meta)

- `GET /api/channels/whatsapp/webhook` (verification)
- `POST /api/channels/whatsapp/webhook` (message callback)

## Required plan setting

Superadmin must enable `whatsapp_enabled=true` on the organization's plan (or override in organization limits).

## Environment variables

Optional, recommended for webhook signature verification:

- `META_APP_SECRET`
- `WHATSAPP_GRAPH_VERSION` (default `v21.0`)

## Meta setup

1. In Meta Developer App, add WhatsApp product.
2. Use webhook URL:
   - `https://<your-domain>/api/channels/whatsapp/webhook`
3. Set webhook verify token (same value you save in `PUT /api/admin/whatsapp/config`).
4. Subscribe to WhatsApp message events.
5. Use phone number ID and long-lived access token from Meta in admin config.

## Admin config payload example

```json
{
  "widget_id": "<existing-widget-id>",
  "phone_number_id": "<meta-phone-number-id>",
  "waba_id": "<optional-waba-id>",
  "access_token": "<meta-access-token>",
  "verify_token": "<random-verify-token>",
  "business_phone_number": "+91XXXXXXXXXX",
  "is_active": true
}
```

## Test from mobile

1. Configure channel via `PUT /api/admin/whatsapp/config`.
2. Send `POST /api/admin/whatsapp/test-message` to your own WhatsApp number.
3. Message the connected business number from your phone.
4. Bot replies should appear in WhatsApp; conversations are stored with session id format:
   - `wa:<organization_id>:<customer_phone>`
