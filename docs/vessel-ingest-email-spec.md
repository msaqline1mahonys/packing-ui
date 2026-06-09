# Vessel Ingest — Email Path (Phase 4 spec)

> Status: **spec only, not implemented**. Phase 3 (manual upload) is the working
> ingest today. This document defines how to extend it so vessel schedule CSVs
> can arrive by email without manual intervention.

## Goal

Customer forwards the carrier email (containing `vs*.csv` and `vr*.csv`
attachments, delivered roughly every 2 hours) to a Mahonys Packing address. The
backend reads attachments, calls the existing `VesselScheduleIngestService`, and
records an audit row in `vessel_ingest_runs` with `source = 'email'`.

The ingest service itself does not change — only the trigger does.

## Delivery option (chosen)

**Inbound webhook** (Postmark / SendGrid / Mailgun / AWS SES Inbound).

- A unique forwarding address is allocated per tenant
  (e.g. `vessel-ingest+<token>@in.mahonys-packing.com`).
- The email provider receives the message, parses MIME, base64-encodes
  attachments, and POSTs JSON to:
  ```
  POST /api/webhooks/vessel-ingest/{tenant_token}
  ```
- The webhook handler resolves the tenant from `{tenant_token}`, decodes the
  attachments, and calls `VesselScheduleIngestService->ingest()`.

Rejected alternative: IMAP / Microsoft Graph polling. Adds credential management
and one-mailbox-per-source operational burden. Revisit only if external webhook
services are blocked for compliance reasons.

## Schema additions

### `tenant_ingest_tokens`

| column            | type      | notes                                                  |
|-------------------|-----------|--------------------------------------------------------|
| id                | uuid pk   |                                                        |
| organization_id   | uuid fk   |                                                        |
| site_id           | uuid fk   |                                                        |
| token             | string    | URL-safe, unique. Surfaced in the forwarding address.  |
| label             | string    | Human-readable, e.g. "Patrick PB schedule".           |
| created_by        | uuid fk   | Users.id                                               |
| last_used_at      | timestamp | Touched on each successful webhook delivery.           |
| disabled_at       | timestamp | Soft-disable without revoking history.                 |
| timestamps        |           |                                                        |

Token rotation: generate a new token, mark the old `disabled_at`. Carrier emails
referencing the old address bounce or 404 until the customer updates their
forwarding rule.

## Controller surface

```
POST   /api/webhooks/vessel-ingest/{token}        — provider webhook (unauthenticated, token in URL)
GET    /api/reference-data/vessels/ingest-tokens  — list tenant tokens (auth:api)
POST   /api/reference-data/vessels/ingest-tokens  — generate a new token
DELETE /api/reference-data/vessels/ingest-tokens/{id} — disable a token
```

### `VesselIngestWebhookController::receive()`

1. Look up `tenant_ingest_tokens` by `token`; reject 404 if missing or `disabled_at` set.
2. Extract attachments from the provider's payload format (provider-specific
   normaliser — see below).
3. For each attachment whose filename matches `/^vs.*\.csv$/i` or `/^vr.*\.csv$/i`,
   decode and stream to a temp file (`storage/app/ingest-tmp/{run-uuid}/`).
4. Construct `IngestContext` with:
   - `organizationId`, `siteId` from the resolved token.
   - `userId = null` (no human triggered this run).
   - `source = 'email'`.
   - `filenameVs`, `filenameVr` from the email's attachment names.
5. Call `VesselScheduleIngestService->ingest()` exactly as the manual-upload
   path does.
6. Write the `vessel_ingest_runs` row with `source = 'email'`.
7. Return `200 OK` with `{ status, run_id, summary }`. Providers retry on
   non-2xx, so failures must still 200 once recorded (idempotency relies on the
   token, not the response code).

## Provider normaliser

A thin per-provider adapter in `app/Webhooks/Vessel/` translates the provider's
JSON into a common `IncomingEmail` DTO:

```php
class IncomingEmail {
    public string $fromAddress;
    public string $subject;
    public Carbon $receivedAt;
    /** @var array<int, IncomingAttachment> */
    public array $attachments;
}

class IncomingAttachment {
    public string $filename;
    public string $contentType;
    public string $content; // already base64-decoded
}
```

Adapters:
- `PostmarkInboundAdapter` — JSON with `Attachments[]` (Name, ContentType, Content base64).
- `SendgridInboundAdapter` — multipart/form-data with `attachment-info` JSON.
- `MailgunInboundAdapter` — multipart/form-data with `attachment-N` files.
- `SesInboundAdapter` — S3-stored raw MIME; requires extra parsing step.

The controller picks an adapter by route or by configured provider. Postmark is
recommended as the default — cheapest provider with sane inbound JSON, no SES
S3 dance.

## Tenant resolution

Token → `tenant_ingest_tokens.organization_id` + `site_id`. The token IS the
authentication; no bearer header. Rotate by re-issuing the token in the UI.

## Idempotency

The same email may be delivered twice (provider retries). Because
`VesselScheduleIngestService` is upsert-based and keys on
`(org, site, lloyds, voyage)`, re-processing is a no-op except for
`last_ingested_at` and `vessel_ingest_runs` rows.

If duplicate audit rows become noisy, the controller can dedupe by hashing
`(from, subject, message_id?, attachment_md5s)` and skipping when the same hash
exists within the last 24 hours.

## Frontend changes

A new tab under `/reference-data/vessel` (or a settings page):
- Token list with copy-to-clipboard for each forwarding address.
- "Generate token" button.
- "Disable" per row.
- Recent runs feed (already exists from Phase 3's `vessel_ingest_runs` view).

## Migration from manual to email

Both paths can run side-by-side. Users adopt email by setting up their carrier
forwarding rule to the issued address; manual upload remains a fallback for
debugging or re-ingest of old files.

## Open questions

- Per-organization vs per-site tokens? Above assumes per-site (which matches
  how reference data is scoped today), but org-level tokens may simplify
  customer setup for single-site orgs.
- Sender allow-list? Should the webhook reject deliveries whose `From` doesn't
  match a configured list (anti-spoof)? Probably yes for production; defer for
  MVP.
- Retention of raw payloads. Provider keeps a copy; we could also store the
  raw vs/vr files in `storage/app/ingest-archive/{run-uuid}/` for forensic
  re-ingest. Optional, controlled by config.
