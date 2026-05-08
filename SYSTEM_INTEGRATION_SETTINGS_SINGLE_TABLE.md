# System Integration Settings - Single Table Design

## Goal

Store all site-scoped integration configuration in one table while supporting:

- PEMS
- ContainerChain
- ContainerSpace
- PRA
- Fumigation (shared defaults)

This design avoids creating separate tables per integration and supports incremental, panel-level saves.

## Table Definition

```sql
CREATE TYPE integration_type AS ENUM (
  'PEMS',
  'CONTAINER_CHAIN',
  'CONTAINER_SPACE',
  'PRA',
  'SHARED'
);

CREATE TABLE system_integration_settings (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  integration_type integration_type NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, integration_type)
);
```

## Why One Table Works

- One row per `site_id + integration_type`
- Integration-specific fields live in `settings` JSONB
- New fields can be added without schema migrations
- Supports partial updates for each panel/tab

## JSON Shapes by Integration Type

### PEMS

```json
{
  "active": true,
  "userId": "abc123",
  "vendorToken": "secret-token",
  "tokenExpiryDate": "2026-06-15",
  "ecrUrl": "https://...",
  "gppirUrl": "https://...",
  "resubmissionUrl": "https://...",
  "fileAttachmentUrl": "https://..."
}
```

### CONTAINER_CHAIN

```json
{
  "active": true,
  "containerChainId": "site-01",
  "containerChainPassword": "secret"
}
```

### CONTAINER_SPACE

```json
{
  "active": false,
  "containerSpaceId": "",
  "containerSpacePassword": ""
}
```

### PRA

```json
{
  "active": true,
  "praInformation": "Optional structured notes",
  "daffSiteId": "DAFF-123"
}
```

### SHARED (Fumigation)

```json
{
  "fumigationProviderName": "Provider Pty Ltd",
  "fumigationProviderLicense": "LIC-9988"
}
```

## Validation Rules (Application Layer)

Validation should happen in service/controller logic, not in table columns:

- `integration_type` must be one of enum values
- URL fields must be valid `http`/`https`
- `tokenExpiryDate` must be a valid date
- If `active = true`, required secret fields must be non-blank
  - PEMS: `vendorToken`
  - ContainerChain: `containerChainPassword`
  - ContainerSpace: `containerSpacePassword`
- Optional strict mode: reject unknown JSON keys per integration type

## Save Strategy: Panel-Level Partial Update

Each save action should update only the relevant keys for that panel.

### Upsert Pattern

```sql
INSERT INTO system_integration_settings (site_id, integration_type, settings)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (site_id, integration_type)
DO UPDATE SET
  settings = system_integration_settings.settings || EXCLUDED.settings,
  updated_at = now();
```

This keeps unrelated keys unchanged and allows independent Save/Cancel behavior per panel.

## Read Pattern

```sql
SELECT integration_type, settings
FROM system_integration_settings
WHERE site_id = $1;
```

Map results to a typed structure in the app:

- `settingsByType.PEMS`
- `settingsByType.CONTAINER_CHAIN`
- `settingsByType.CONTAINER_SPACE`
- `settingsByType.PRA`
- `settingsByType.SHARED`

## Indexing

Required:

- `UNIQUE (site_id, integration_type)`

Optional for analytics/filtering by JSON keys:

```sql
CREATE INDEX idx_system_integration_settings_settings_gin
ON system_integration_settings
USING GIN (settings);
```

## Security Notes

Sensitive values (tokens/passwords) are stored in JSONB, so:

- Encrypt secrets before persisting (or use DB/KMS encryption controls)
- Never log plaintext secret fields
- Mask values in UI by default and reveal only on user action
- Restrict API responses to least privilege

## Suggested API Contract

- `GET /api/system-settings/integrations?siteId=<id>`
  - Returns integration settings grouped by type for one site

- `PATCH /api/system-settings/integrations`
  - Body:
    ```json
    {
      "siteId": 1,
      "integrationType": "PEMS",
      "settings": {
        "ecrUrl": "https://..."
      }
    }
    ```
  - Performs validation, merge, and upsert

## Tradeoffs

### Pros

- Flexible and future-proof
- Low schema churn
- Simple panel-level save semantics

### Cons

- DB does not strongly enforce per-field schema
- Requires disciplined application-layer validation and tests
