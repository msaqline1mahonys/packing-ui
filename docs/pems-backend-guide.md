# PEMS Backend Guide

Plant Export Management Service (PEMS) integration for the packing application. This guide extends **existing tables** wherever possible and adds **transactional tables only** for inspection submissions.

**UI terminology:** ECR = Empty Container Inspection (PEMS `ECI`), GPPIR = Grain and Plant Product Inspection Record (PEMS `CGI`).

**Full SQL:** [`pems-schema.sql`](pems-schema.sql) · Rollback: [`pems-schema-rollback.sql`](pems-schema-rollback.sql)

---

## 1. Table consolidation strategy

| Original PEMS spec | This implementation |
|---|---|
| `pems_ao_tokens` | **`users`** + `user_classifications` array |
| `pems_establishments` | **`sites`** + PEMS address columns |
| `pems_rfp_records` | **`packs`** + RFP columns; inspections FK `pack_id` |
| `pems_vendor_config` | **`system_settings`** keys (`pems_*`) |
| `pems_system_settings` | **`system_settings`** keys (`pems_*`) |
| `pems_inspections` | **`pack_pems_inspections`** |
| `pems_inspection_containers` | **`pack_pems_inspection_containers`** |
| `pems_inspection_lines` | **`pack_pems_inspection_lines`** |
| `pems_time_entries` | **`pack_pems_time_entries`** |
| `pems_associated_aos` | **`pack_pems_inspection_users`** |
| `pems_attachments` | **`pack_pems_attachments`** |
| `pems_reference_data_cache` | **`reference_data_cache`** (`source = 'PEMS'`) |
| `pems_submission_log` | **`integration_api_log`** (`integration = 'PEMS'`) |

---

## 2. Extended existing tables

### 2.1 `users`

Add `user_classifications text[]` — values:

- `AUTHORISED_OFFICER` — PEMS AO; shows AO token/number fields in UI
- `FUMIGATOR` — fumigation licence fields
- `PACKER` — packers account access
- `WEIGHBRIDGE` — weighbridge access

**Sync with legacy booleans (do not drop):**

| Classification | Legacy column |
|---|---|
| `AUTHORISED_OFFICER` | `ao_active` |
| `FUMIGATOR` | `is_fumigator` |
| `PACKER` | `packers_account_access` |
| `WEIGHBRIDGE` | `weighbridge_access` |

AO query: `WHERE 'AUTHORISED_OFFICER' = ANY(user_classifications) AND active = true`

Encrypt at rest: `ao_token`, `ao_pems_password`

### 2.2 `sites`

| Column | Notes |
|---|---|
| `establishment_number` | PEMS establishment number |
| `yard_id` | Integer sent as `yardId` in ECI SOAP |
| `address_line1`, `address_line2`, `suburb`, `state_code`, `postcode` | ECI address block |

Keep existing `name`, `code`, `address`, `yardNo`. Migrate `yardNo` → `establishment_number` where empty.

### 2.3 `packs`

Existing: `rfp`, `destination_country`, `import_permit_number`, `commodity`, `exporter`, `rfp_expiry`, `rfp_commodity_code`

Add:

| Column | Notes |
|---|---|
| `rfp_pack_type` | RFP refresh field |
| `rfp_total_quantity` | decimal(15,4) |
| `rfp_quantity_unit` | e.g. `M/TONS` |
| `rfp_flow_path` | e.g. `Packaged` |
| `original_rfp_number` | nullable |
| `rfp_refresh_snapshot` | jsonb — last submitted refresh-field values for error 30171 |

**30171 refresh fields:** `destination_country`, `commodity`, `rfp_pack_type`, `sites.establishment_number`

### 2.4 `system_settings`

Seed keys (see SQL): `pems_active_environment`, `pems_vendor_token`, `pems_installation_username`, `pems_installation_password`, `pems_org_name_prefix`, `pems_client_reference_system`, `pems_base_url`, `pems_submission_enabled`, `pems_reference_data_cache_ttl_hours`, `pems_max_attachment_size_mb`, `pems_allowed_mime_types`

Per-site optional overrides remain in `system_integration_settings` (`integration_type = 'PEMS'`).

---

## 3. New transactional tables

See [`pems-schema.sql`](pems-schema.sql) for full DDL.

**`pack_pems_inspections`** — master record per submission (`ECI`, `CGI`, etc.)

- FKs: `pack_id`, `site_id`, `submitted_by_user_id`, `parent_inspection_id`
- `inspection_reason`: `R`, `RS`, `S` (re-inspection, re-submit, supplementary)
- `status`: `draft`, `submitted`, `completed`, `under_review`, `cancelled`, `failed`

Child tables: containers, lines, time_entries, inspection_users, attachments.

---

## 4. PemsApiService

```
PemsApiService
├── buildSoapHeader(aoToken, vendorToken, installationUsername, installationPassword, correlationId, clientReferenceSystem)
├── generateCorrelationId(orgPrefix)         // prefix-{uuid}, max 50 chars
├── refreshReferenceDataCache(refType?)
├── submitEmptyContainerInspection(inspectionId)
├── submitContainerisedGoodsInspection(inspectionId)
├── uploadAttachment(attachmentId)
├── validateEmptyContainer(containerNumber, aoToken)
├── checkInspectionStatus(pemsInspectionId, aoToken)
└── parseSoapFault(responseXml)
```

Rules:

- Read active config from `system_settings` (`pems_*` keys)
- Log every call to `integration_api_log` (mask tokens as `[REDACTED]`)
- On SOAP fault: update inspection `status = 'failed'`, set `submission_error`, throw — no auto-retry
- Error **30171** → throw `PemsRfpRefreshError` (cancel prior inspections, allow fresh submit)

### Endpoint URLs

Base URLs:

- Vendor test: `https://online-vnd.agriculture.gov.au/pems-sdm/pems-ws/`
- Production: `https://online.agriculture.gov.au/pems-sdm/pems-ws/`

| Service | Suffix |
|---|---|
| Empty container | `inspection-ws` |
| Containerised goods | `containerised-goods-ws` |
| QSR | `qsr-inspection-ws` |
| Attachment | `attachment-ws` |
| Reference data | `reference-data-ws` |
| Validate container | `validate-container` |
| Inspection status | `inspection-status` |
| Resubmission | `resubmission-ws` |

---

## 5. Validations (before SOAP)

### ECI

- ≥1 container with `container_number`, `inspection_level_code`, `inspection_result_code`
- `passed_after_rectification` ∈ `Y`/`N` if set
- `yard_id` OR full site address required
- ≥1 time entry

### CGI / GPPIR

- Pack `rfp` required; site `establishment_number` required
- Each container: valid unexpired ECI locally OR `validateEmptyContainer`
- Trade desc fields: `Y`/`N` and `Y`/`N`/`NA`
- If `inspection_reason = RS`: non-empty `inspections_to_be_cancelled`
- ≥1 inspection line, ≥1 time entry

### Attachments

- Inspection has `pems_inspection_id`
- If `attachment_type = IM`: `import_permit_number` required
- MTOM CID must not contain spaces

### Supplementary

- `inspection_reason = S`, `parent_inspection_id` set

---

## 6. SOAP field mapping

### ECI

| DB | SOAP |
|---|---|
| `sites.yard_id` | `createEmptyContainerRequest.yardId` |
| `sites.address_line1` | `createEmptyContainerRequest.address.line1` |
| `sites.suburb` | `...address.suburb` |
| `sites.state_code` | `...address.stateCode` |
| `sites.postcode` | `...address.postcode` |
| container fields | `emptyContainerInspectionResult.*` |
| `users.ao_token` | `authorisedOfficerToken` |
| time entries | `PemsTimeEntryDetail.timeEntry` |
| associated users → tokens | `associatedAODetail.associatedAOToken` |

### CGI

| DB | SOAP |
|---|---|
| `packs.rfp` | `createContainerisedGoods.rfpNumber` |
| `sites.establishment_number` | `createContainerisedGoods.establishmentNumber` |
| inspection reason / cancelled / trade desc | `createContainerisedGoods.*` |
| line fields | `containerisedGoodsInspectionResult.*` |

---

## 7. REST API contract

Base: `{API_URL}/api/pems`

| Method | Path | Purpose |
|---|---|---|
| GET | `/settings` | Org PEMS settings (non-secret fields) |
| PATCH | `/settings` | Update org settings (admin) |
| GET | `/reference-data/{refType}` | Cached REF codes |
| POST | `/reference-data/refresh` | Force refresh |
| POST | `/inspections` | Create draft |
| GET | `/inspections/{id}` | Read inspection |
| PATCH | `/inspections/{id}` | Update draft |
| POST | `/inspections/{id}/submit-eci` | Submit ECI |
| POST | `/inspections/{id}/submit-cgi` | Submit CGI |
| POST | `/inspections/{id}/attachments` | Upload attachment |
| POST | `/inspections/{id}/cancel` | Cancel (30171 recovery) |
| GET | `/submission-log` | Audit log |

### Create inspection request (frontend → backend)

```json
{
  "packId": 10442,
  "siteId": 1,
  "inspectionType": "ECI",
  "inspectionReason": "",
  "parentInspectionId": null,
  "inspectionsToBeCancelled": [],
  "submittedByUserId": 1,
  "inspectionStartDatetime": "2026-05-22T08:00:00Z",
  "inspectionEndDatetime": "2026-05-22T10:00:00Z",
  "additionalDeclaration": "N/A",
  "tradeDescRequiredForGoods": null,
  "tradeDescPhysicallyApplied": null,
  "tradeDescRequirementMeet": null,
  "associatedUserIds": [],
  "timeEntries": [
    {
      "userId": 1,
      "activityDate": "2026-05-22",
      "startTime": "08:00",
      "endTime": "10:00",
      "activityTypeCode": "INSPECTION",
      "comment": ""
    }
  ],
  "containers": [
    {
      "packContainerId": "10442-1",
      "containerNumber": "MAXU1356875",
      "inspectionLevelCode": "Consumable",
      "inspectionResultCode": "Pass",
      "sealNumber": "SEAL001",
      "passedAfterRectification": "N",
      "inspectionRemarkCode": "",
      "inspectedByUserId": 1,
      "lines": []
    }
  ]
}
```

### Error response (30171)

```json
{
  "error": "PemsRfpRefreshError",
  "faultCode": "30171",
  "message": "RFP refresh fields changed after first inspection. Cancel prior inspections and submit fresh records.",
  "refreshFields": ["destination_country", "commodity", "rfp_pack_type", "establishment_number"]
}
```

---

## 8. Reference data cache (startup)

Cache these `ref_type` values in `reference_data_cache` where `source = 'PEMS'`:

`REF_CONT_INSP_RESULT`, `REF_INSPECTION_RESULT`, `REF_CONT_INSP_LEVEL`, `REF_ACTIVITY`, `REF_COMMODITY`, `REF_PACKAGE_TYPE`, `REF_PACKAGE_UNIT`, `REF_CONT_INSP_REMARK`, `REF_INSP_REMARK_CODE`, `REF_STATE`, `REF_POSTCODE`, `REF_ATTACHMENT_TYPE`, `REF_INSPECTION_STATUS`, `REF_RE_INSPECTION_REASON`, `REF_SAMPLING_TYPE`, `REF_SAMPLING_INLINE_TYPE`, `REF_SUB_PACKAGE_TYPE`

---

## 9. Implementation order

1. Run `pems-schema.sql`
2. Implement classification sync on `users` read/write
3. Extend sites/packs API serializers with new columns
4. Seed `system_settings` PEMS keys
5. Implement `PemsApiService` + validator
6. Implement REST endpoints
7. Startup reference-data refresh job
8. Integration test against vendor_test before `pems_submission_enabled = true`

---

## 10. Frontend alignment

The packing-ui frontend sends payloads matching section 7. Master data is captured on:

- **Contact → Users** — classifications + AO fields
- **Reference Data → Sites** — establishment address
- **Pack form** — RFP header fields
- **More Settings → Integration** — org vendor config
- **Pack detail / PEMs tab** — inspection-only fields at submit

See [`../BACKEND_DATA_GUIDE.md`](../BACKEND_DATA_GUIDE.md) PEMS section for field-level mapping.
