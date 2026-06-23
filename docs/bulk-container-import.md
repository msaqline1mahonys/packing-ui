# Bulk container number import

## Model (2026 redesign)

- **Releases** are reference-data entities with a global `container_count` cap and parks × transporters.
- **Packs** link to releases via M2M (`release_id` only — no park/transporter on the pack link).
- **Containers** store `release_id` + `empty_container_park_id` + `transporter_id` (a valid combo on the release).
- **Usage**: per-pack combo counts are computed client-side; global picked up / remaining come from the releases API `usage` block.

## Import flow

1. User opens **Bulk import containers** (pack form or packers schedule).
2. Select **release** from the pack's linked releases.
3. Select **container park** and **transporter** (filtered to valid combos on that release).
4. Paste container numbers → preview → apply to empty slots.

Persist: pack form saves via `savePack` + per-container `updateContainer` PATCH; packers schedule PATCHes containers directly.

See [`lib/container-bulk-import.js`](../lib/container-bulk-import.js) and [`components/packing-schedule/bulk-container-import-dialog.jsx`](../components/packing-schedule/bulk-container-import-dialog.jsx).
