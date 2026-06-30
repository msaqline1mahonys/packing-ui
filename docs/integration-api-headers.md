# External Integration API — Standard Headers

> Status: **implemented** for vessel schedule ingest (`VESSEL_SCHEDULE`). Additional
> integration types will reuse the same header contract.

## Purpose

Mahonys Packing receives data from external systems (carrier feeds, middleware,
email parsers, etc.). Every machine-to-machine endpoint uses the same request
headers so tenant and site context are explicit and credentials are scoped per
site and integration type.

## Staging / production base URL

- UI: `https://packing.clutchbangladesh.com`
- API: value of `NEXT_PUBLIC_API_URL` on the server (typically the API subdomain,
  e.g. `https://api.clutchbangladesh.com/api`)

All paths below are relative to the API base (`/api/...`).

## Required headers (all integrations)

| Header | Required | Description |
|--------|----------|-------------|
| `X-Clutch-Organization-Id` | yes | Organization UUID |
| `X-Clutch-Site-Id` | yes | Site UUID — data is written only for this site |
| `X-Clutch-Integration-Type` | yes | Integration enum value (must match the endpoint) |
| `Authorization` | yes* | `Bearer <integration_key>` |
| `X-Clutch-Integration-Key` | yes* | Alternative to `Authorization` when Bearer is awkward |
| `X-Clutch-Request-Id` | no | Caller trace id; echoed on the response when sent |

\* Send **one** of `Authorization: Bearer …` or `X-Clutch-Integration-Key`.

### Validation rules

1. All required headers must be present.
2. `X-Clutch-Integration-Type` must match the endpoint (e.g. `VESSEL_SCHEDULE`
   for vessel schedule ingest).
3. The integration key must be active, belong to the same
   `organization_id` + `site_id`, and be issued for that integration type.
4. The site must belong to the organization.

Failures return JSON `{ "success": false, "message": "…" }` with `401`, `403`, or
`422` as appropriate.

## Integration types

| Value | Endpoint | Notes |
|-------|----------|-------|
| `VESSEL_SCHEDULE` | `POST /api/integrations/vessel-schedule` | VS/VR CSV ingest |

Future types (PEMS, ContainerChain, etc.) will add rows here and new routes under
`/api/integrations/…` using the same headers.

## Credential management (UI / admin)

Authenticated users with site access can issue keys:

```
GET    /api/integrations/credentials?site_id=<uuid>
POST   /api/integrations/credentials
DELETE /api/integrations/credentials/{id}
```

### Create credential

```http
POST /api/integrations/credentials
Authorization: Bearer <user_passport_token>
Content-Type: application/json

{
  "site_id": "<site uuid>",
  "integration_type": "VESSEL_SCHEDULE",
  "label": "Patrick terminal feed"
}
```

Response includes `integration_key` **once**. Store it in the calling system;
only `key_prefix` is retained for display afterwards.

## Vessel schedule ingest

Updates vessel departures (voyages) from carrier `vs*.csv` and/or `vr*.csv`
files. Uses the same ingest engine as the manual upload in Shipping Details.

**Schedule and rotation may arrive in separate requests.** Send only the file you
have in each call — you do not need both in one payload.

| File | Field (multipart) | Field (JSON) | Role |
|------|-------------------|--------------|------|
| Vessel Schedule | `vs_file` | `vs_csv` (base64) | Creates/updates vessels and voyages |
| Vessel Rotation | `vr_file` | `vr_csv` (base64) | Enriches terminal names; updates terminal on matching voyages |

Typical flow when the carrier delivers files on different cadences:

1. `POST` with `vs_file` only → voyages created/updated
2. `POST` with `vr_file` only → terminal names enriched, voyage terminals updated

Both files in one request still works (`ingest_mode: combined`).

```http
POST /api/integrations/vessel-schedule
X-Clutch-Organization-Id: <org uuid>
X-Clutch-Site-Id: <site uuid>
X-Clutch-Integration-Type: VESSEL_SCHEDULE
Authorization: Bearer clk_…
Content-Type: multipart/form-data

vs_file=<vs.csv>          # schedule-only request
# or
vr_file=<vr.csv>          # rotation-only request
```

### JSON alternative (base64)

For middleware that cannot send multipart files:

```http
POST /api/integrations/vessel-schedule
Content-Type: application/json
…headers as above…

{
  "vs_csv": "<base64>",
  "vr_csv": "<base64>",
  "vs_filename": "vs20260630.csv",
  "vr_filename": "vr20260630.csv"
}
```

At least one of `vs_file` / `vr_file` (multipart) or `vs_csv` / `vr_csv`
(JSON) is required per request. Send **one file per request** when the carrier
delivers schedule and rotation separately; both may still be combined in a
single call.

The schedule file (`vs`) drives voyage upserts. The rotation file (`vr`)
enriches terminal names and updates terminals on voyages that already exist.

### Success response

```json
{
  "success": true,
  "message": "Vessel schedule ingest completed successfully.",
  "data": {
    "run_id": "<uuid>",
    "status": "success",
    "report": {
      "ingest_mode": "schedule",
      "vessels_created": 3,
      "vessels_updated": 0,
      "voyages_created": 4,
      "voyages_updated": 0,
      "skipped_rows": 0,
      "stubs_created": { "terminals": 2, "ports": 2, "shipping_lines": 2 },
      "errors": []
    },
    "request_id": "optional-trace-id"
  }
}
```

`status` may be `success`, `partial`, or `failed`. Runs are audited in
`vessel_ingest_runs` with `source = integration_api`.

## Example: curl (staging)

Replace placeholders with real UUIDs and key from credential creation.

```bash
curl -X POST "https://<api-host>/api/integrations/vessel-schedule" \
  -H "X-Clutch-Organization-Id: <org-uuid>" \
  -H "X-Clutch-Site-Id: <site-uuid>" \
  -H "X-Clutch-Integration-Type: VESSEL_SCHEDULE" \
  -H "Authorization: Bearer clk_…" \
  -F "vs_file=@vs20260630.csv" \
  -F "vr_file=@vr20260630.csv"
```

## Related docs

- Manual upload UI: `components/ingest/vessel-ingest-dialog.jsx`
- Email webhook (future): `docs/vessel-ingest-email-spec.md`
- Per-site integration settings (PEMS, etc.): `SYSTEM_INTEGRATION_SETTINGS_SINGLE_TABLE.md`
