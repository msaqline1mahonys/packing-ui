# Backend Data Guide

This guide maps front-end data structures in `lib/Data.js` to backend schema expectations.

## Source Of Truth

- Central data file: `lib/Data.js`
- Legacy bridge (re-export): `lib/master-data.js`
- App pages now consume centralized datasets, including accounting, contacts, product settings, and key reference data masters.

## Product Settings

- `COMMODITY_TYPE_MASTER_ROWS`
  - Keys: `id`, `name`, `acosCode`, `testRequired`
  - Relation: parent to `COMMODITY_MASTER_ROWS` by `commodityTypeId`

- `COMMODITY_MASTER_ROWS`
  - Keys: `id`, `commodityCode`, `description`, `commodityTypeId`, `hsCode`, `pemsCode`, `status`, `unitType`, `shrinkAmount`
  - Relation: each commodity belongs to one commodity type
  - Includes `testThresholds[]` for commodity-grade validation per test

- `COMMODITY_TEST_DEFINITIONS`
  - Master test catalog for product testing rules
  - Keys: `id`, `code`, `name`, `unit`, `minValue`, `maxValue`
  - Relation: `COMMODITY_MASTER_ROWS.testThresholds[].test` should map to test definition names/codes
  - Backend model suggestion:
    - `commodity_tests` (master)
    - `commodity_test_thresholds` (child rows keyed by `commodity_id + test_id`)

- `SHRINK_SETTINGS_DATA`
  - Layers (highest to lowest priority):
    - `customerCommodityShrinkRules` (`customerId + commodityId`)
    - `commodityShrinkRules` (`commodityId`)
    - `commodityTypeShrinkRules` (`commodityTypeId`)
    - `defaultShrinkPercent`
  - Suggested constraints:
    - unique `commodity_type_id` in type-level rules
    - unique `commodity_id` in commodity-level rules
    - unique `(customer_id, commodity_id)` in customer+commodity rules

## Contacts

- `CUSTOMER_MASTER_ROWS`
  - Lightweight lookup (`id`, `code`, `name`) used by pricing/contracts

- `CUSTOMER_CONTACT_ROWS`
  - Customer profile with child arrays:
    - `emails[]`
    - `addresses[]`
    - `contacts[]` (`name`, `email`, `phone`)
    - `warnings[]` (`warningDescription`, `showOnPacks`)
  - Backend model: one customer table + child tables for emails/addresses/contacts/warnings

- `CONTACT_USER_ROWS`
  - Keys: `id`, `name`, `email`, `role`, `active`, `passwordUpdatedAt`
  - Security note: password must be stored as hash only in backend

- `USER_PERMISSION_USER_ROWS`
  - User roster used in the user-permission page (`id`, `name`, `email`, `role`)
  - Permission assignments are keyed by user and map to module/submodule permission IDs
  - Backend model suggestion:
    - `users` table
    - `permissions` table (module/page/action level)
    - `user_permissions` join table with unique `(user_id, permission_id)`

- `TRANSPORTER_MASTER_ROWS`
  - Keys: `id`, `code`, `name`, `email`, `contacts[]`
  - Relation: referenced by transport pricing (`transporterId`)


## Accounting And Pricing

- `DEFAULT_CONTAINER_SIZES`
  - Shared container size lookup used across pricing pages

- `GENERAL_PACK_PRICING_STATE`
  - Pricing hierarchy:
    - `commodityCustomerPrices` (customer + commodity + size)
    - `commodityTypeCustomerPrices` (customer + commodity type + size)
    - `commodityPrices` (commodity + size)
    - `defaultPackingPrices` (commodity type + size)
  - Suggested unique keys:
    - `(commodity_type_id, container_size)`
    - `(commodity_id, container_size)`
    - `(customer_id, commodity_type_id, container_size)`
    - `(customer_id, commodity_id, container_size)`

- `FEES_AND_CHARGES_ROWS`
  - Keys: `chargeName`, `chargeDescription`, `chargeRate`, `chargeType`, `chargeClassification`, `accountCode`, `applyToAllPacks`
  - Enum/reference tables:
    - `CHARGE_TYPES`
    - `CHARGE_CLASSIFICATIONS`

## Packing Schedule (Pack Structure)

- `PACK_TEMPLATE`
  - Canonical pack payload shape used by the Add Pack form
  - Includes:
    - core: `packType`, `importExport`, `status`, `jobReference`, `date`
    - parties: `customerId`, `exporter`, `siteId`
    - product: `commodityTypeId`, `commodityId`, `testRequired`, `shrinkTaken`
    - quantity: `containersRequired`, `quantityPerContainer`, `maxQtyPerContainer`, `mtTotal`
    - destination/shipping: `destinationCountry`, `destinationPort`, `transshipmentPort`, `transshipmentPortCode`, `shippingLineId`, `vesselDepartureId`
    - permit/rfp/docs: `importPermit*`, `rfp*`, `packingInstructionFiles`, `jobNotes`
    - sampling: `sampleRequired`, `sampleLocations[]`, `sampleSentDates[]`, `sampleStatuses[]`
    - logistics arrays: `emptyContainerParkIds[]`, `transporterIds[]`, `assignedPackerIds[]`
    - release lines: `releaseDetails[]` with `{ releaseRef, emptyContainerParkId, transporterId }`

- `PACK_FORM_LOOKUPS`
  - Lookup sets used by packing schedule forms:
    - sites, customers, commodity types, commodities
    - shipping lines, container parks, transporters, packers
    - CSV vessel schedule rows

- `PACK_SCHEDULE_ROWS`
  - Demo list rows used by schedule table/detail pane

- `PACK_STATUSES`, `SAMPLE_STATUSES`
  - Enumerated workflow states for pack lifecycle and sample workflow

Backend modeling suggestion:
- `packs` (header)
- `pack_release_details` (child lines, 1:N with packs)
- `pack_files` (if storing many files by category)
- `pack_samples` or split sample tables (locations/sent dates/status events)
- `pack_assignments` join tables (pack->transporter, pack->packer, pack->container_park)

## Reference Data (Requested)

The following are now centralized and available in `lib/Data.js`:

- `REFERENCE_COUNTRIES_ROWS`
  - Includes country master + nested `contactItems[]` and `warningItems[]`

- `REFERENCE_TRUCK_ROWS`
  - Truck register including rego/name, driver, combination, tare

- `REFERENCE_STOCK_LOCATION_ROWS`
  - Storage location master with site, type, status, capacity

- `REFERENCE_PORT_ROWS`
  - Port master (`code`, `name`, `country`)

- `REFERENCE_VESSEL_ROWS`
  - Vessel schedule data (`voyageNumber`, cutoff/open dates, ETA/ETD, free days, shipping line)

- `REFERENCE_SHIPPING_LINE_ROWS`
  - Shipping line master + contact fields

- `REFERENCE_TERMINAL_ROWS`
  - Terminal master including nested `terminalContacts[]` and revenue/expense price references

## Global Relation Summary

- Commodity Type `1:N` Commodity
- Commodity `1:N` Commodity Test Threshold
- Pack `N:1` Customer
- Pack `N:1` Commodity Type
- Pack `N:1` Commodity
- Pack `N:1` Shipping Line
- Pack `N:1` Vessel Departure
- Pack `1:N` Release Detail
- Customer `1:N` Customer emails/addresses/contacts/warnings
- Transporter `1:N` Transport pricing rows
- Shipping Line `1:N` Vessel
- Country `1:N` Port
- Site `1:N` Stock Location (logical mapping)
- Terminal `1:N` Terminal Contact

## Business Rule Precedence

- Shrink resolution:
  - `customer+commodity -> commodity -> commodityType -> default`
- Pack pricing resolution:
  - `customer+commodity -> customer+commodityType -> commodity -> commodityType default`

These precedence chains should be implemented server-side for deterministic calculations.

---

## Fumigation Master Data

These tables cover the fumigation master data managed via the `/fumigation` admin pages. All data currently lives in localStorage; backend should expose REST endpoints for each resource.

### `fumigants`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `code` | varchar | e.g. `PH3`, `MBR`, `SF` |
| `name` | varchar | e.g. `Phosphine`, `Methyl Bromide`, `Sulfuryl Fluoride` |
| `chemical_family` | varchar | |
| `active_constituent` | varchar | |
| `product_form` | varchar | `Cylinder`, `Tablet`, `Liquid`, `Gas`, `Granule` |
| `re_entry_ppm` | decimal | Safe re-entry threshold in ppm |
| `default_unit` | varchar | `ppm`, `g/m³`, etc. |

API: `GET /api/fumigants`, `POST /api/fumigants`, `PUT /api/fumigants/{id}`, `DELETE /api/fumigants/{id}`

**Seeded fumigants** in `lib/fumigation-store.js → DEFAULT_FUMIGANTS`: PH3 (Phosphine), MBR (Methyl Bromide), SF (Sulfuryl Fluoride). When seeding the backend, mirror the same `code` strings — the cert/record documents and pack form key SF-specific behaviour off `fumigant.code === "SF"`.

### `methodologies`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `name` | varchar | |
| `version` | varchar | e.g. `v1.0` |
| `effective_date` | date | |
| `fumigant_id` | integer FK → fumigants | |
| `application_methods` | text[] | `In-container`, `Sheeted stack`, `Silo`, etc. |
| `min_temperature` | decimal | Minimum operating temperature (°C) |
| `max_temperature` | decimal | Maximum operating temperature (°C) |
| `min_exposure` | decimal | Minimum exposure period value |
| `min_exposure_unit` | varchar | `hours` or `days` |
| `dosage_unit` | varchar | Default dosage unit |
| `dosage_guide` | text | Human-readable dosage summary |
| `restraint` | text | Application restraints |
| `ventilation_period` | decimal | Hours after treatment before ventilation |
| `withholding_period` | decimal | |
| `re_entry_ppm` | decimal | |
| `safety_notes` | text | |

API: `GET /api/methodologies`, `POST /api/methodologies`, `PUT /api/methodologies/{id}`, `DELETE /api/methodologies/{id}`

### `methodology_dosage_ranges`

Child table of `methodologies`. One row per temperature band.

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `methodology_id` | integer FK → methodologies | |
| `min_temp_c` | decimal | Lower bound, inclusive |
| `max_temp_c` | decimal | Upper bound, **exclusive** — bands use half-open `[min, max)` intervals |
| `dosage_value` | decimal | |
| `dosage_unit` | varchar | `g/m3`, `ppm`, `mg/L`, `%` — store as `g/m3` not `g/m³` |
| `exposure_value` | decimal | |
| `exposure_unit` | varchar | `hours` or `days` |

Constraints:
- Unique on `(methodology_id, min_temp_c)`.
- Per methodology, ranges must not overlap: `max_temp_c[i] <= min_temp_c[i+1]` when sorted by `min_temp_c`.
- Sorted by `min_temp_c` ascending in API responses.

API: Embedded in `GET /api/methodologies/{id}` as `dosageRanges[]`, or via `GET /api/methodologies/{id}/dosage-ranges`.

**Naming bridge:** frontend uses camelCase (`dosageRanges`, `minTempC`, `maxTempC`, `dosageValue`, `dosageUnit`, `exposureValue`, `exposureUnit`). Frontend read paths use `obj.dosageValue ?? obj.dosage_value` fallback per CLAUDE.md conventions.

### `certificate_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `name` | varchar | |
| `header_text` | text | |
| `footer_text` | text | |
| `body` | text | |
| `fields` | text[] | Array of label strings (e.g. `["Customer","Commodity","Fumigant",...]`). **NOT booleans.** A field is "enabled" if its label string is present in the array. |
| `logo_data_url` | text | Base64 logo override, optional |
| `footer_logo_data_url` | text | Optional |

### `record_templates`

Same structure as `certificate_templates` plus:

| Column | Type | Notes |
|---|---|---|
| `include_certificate_fields` | boolean | If true, render certificate fields block first in the record document |
| `fields` | text[] | Record-specific field labels: `Monitoring start`, `Monitoring intervals`, `Gas readings (top/middle/base)`, `Clearance reading`, `Fumigator sign-off`, `Inspector verification` |

### Pack fumigation fields

These fields live on the `packs` table (or a `pack_fumigation_details` JSON column):

| Field | Type | Notes |
|---|---|---|
| `fumigation_required` | boolean | Admin-confirmed flag |
| `fumigation_timing` | varchar | `before` or `after` (informational only — does not gate pack status) |
| `fumigant_id` | integer FK → fumigants | |
| `methodology_id` | integer FK → methodologies | |
| `certificate_template_id` | integer FK → certificate_templates | |
| `record_template_id` | integer FK → record_templates | |
| `treatment_provider_id` | varchar | Fumigation company ABF/AQIS treatment provider ID |
| `fumigator_accreditation_number` | varchar | Fumigator-in-charge accreditation number (from gov template) |
| `port_of_loading` | varchar | Port of loading (pre-fills into certificate) |
| `commodity_country_of_origin` | varchar | Country of origin for the commodity |
| `fumigation_detail` | jsonb | See expanded shape below |

#### `fumigation_detail` jsonb shape (v2 — gov-template aligned)

| Key | Type | Notes |
|---|---|---|
| `applicationMethod` | varchar | `in-container` or `bulk` |
| `fumigationType` | varchar | `ambient` or `controlled` |
| `targetOfFumigation` | varchar[] | `["commodity","container","packaging"]` |
| `enclosureType` | varchar | `sheeted`, `chamber`, `unsheeted-container`, `other` |
| `enclosureOtherText` | varchar | Description when `enclosureType = other` |
| `enclosureDescription` | text | Free-text description |
| `enclosureLengthM` | decimal | Enclosure length in metres |
| `enclosureWidthM` | decimal | Enclosure width in metres |
| `enclosureHeightM` | decimal | Enclosure height in metres |
| `volumeM3` | decimal | Calculated or measured volume in m³ |
| `consignmentSuitable` | boolean \| null | Whether consignment was found suitable before treatment |
| `consignmentRemedialAction` | text | Remedial action taken if consignment not suitable |
| `actualTonnage` | decimal | Commodity weight (MT) |
| `minForecastedTemperature` | decimal | Min forecast temp (°C) for ambient treatment |
| `minAmbientTemperature` | decimal | Min ambient temp observed |
| `actualTemperature` | decimal | Actual temperature at start of treatment |
| `prescribedDoseRate` | decimal | Dose rate from the methodology schedule (g/m3) |
| `prescribedDoseUnit` | varchar | `g/m3` |
| `prescribedExposure` | decimal | Prescribed exposure period |
| `prescribedExposureUnit` | varchar | `hours` or `days` |
| `prescribedTemperature` | decimal | Minimum temperature in the applicable methodology band |
| `dosageValue` | decimal | Applied dose rate |
| `dosageUnit` | varchar | `g/m3` (canonical — superscript forms are migrated) |
| `calculatedDosageValue` | decimal | Dose × volume = total grams |
| `calculatedDosageUnit` | varchar | `g` |
| `actualDosageAppliedValue` | decimal | Actual amount of fumigant applied (grams) |
| `actualDosageAppliedUnit` | varchar | `g` |
| `chloropicrinUsed` | boolean \| null | Methyl Bromide only |
| `chloropicrinPercent` | decimal | % chloropicrin added (MBR only) |
| `heatersUsed` | boolean \| null | Methyl Bromide only |
| `endPointConcentration` | decimal | Final concentration at end of exposure period (Sulfuryl Fluoride mandatory per SF methodology §10.2; informational for other fumigants). |
| `endPointConcentrationUnit` | varchar | Default `g/m3`. |
| `ctRequired` | decimal | Prescribed concentration-time product, `g·h/m3` — only required when an approved 3rd-party CT system is used. |
| `ctAchieved` | decimal | Actual CT integral achieved, `g·h/m3` — only required when an approved 3rd-party CT system is used. |
| `thirdPartySystem` | boolean | `true` when treatment uses an approved 3rd-party CT system (Section 10.2 SF methodology requires CT-achieved + system identification in lieu of bands). |
| `thirdPartySystemName` | varchar | Name/identifier of the approved 3rd-party system. |
| `exposureTimeValue` | decimal | Applied exposure period |
| `exposureTimeUnit` | varchar | `hours` or `days` |
| `fumigationStartAt` | datetime | ISO datetime — treatment commenced |
| `dosingFinishAt` | datetime | ISO datetime — fumigant injection finished |
| `fumigationEndAt` | datetime | ISO datetime — treatment completed |
| `ventilationStartAt` | datetime | ISO datetime — enclosure ventilation started |
| `monitoringDeviceSerials` | text | Comma-separated monitoring device serials |
| `finalTlvPpm1` | decimal | First final TLV reading (ppm) |
| `finalTlvPpm2` | decimal | Second final TLV reading (ppm) |
| `finalTlvPpm3` | decimal | Third final TLV reading (ppm) |
| `clearanceValue` | decimal | Legacy clearance field (use `finalTlvPpm1` in new code) |
| `topUpEntries` | jsonb[] | `[{id, amountGm3, time, concentrationGm3}]` top-up detail rows |
| `fumigatorName` | varchar | Fumigator-in-charge full name |
| `fumigationResult` | varchar | `pass` or `fail` |
| `governmentOfficerName` | varchar | Government officer name (if supervised) |
| `governmentOfficerSignature` | text | Government officer signature (if supervised) |
| `additionalDeclarations` | text | Additional declaration text on certificate |
| `fumigationNotes` | text | Internal notes |

**Unit normalisation:** All `dosageUnit` / `prescribedDoseUnit` values must be stored and returned as `g/m3` (no superscript). The frontend normalises on load from localStorage; the backend should enforce this constraint at the API layer.

---

## Fumigation Documents (Certificate / Record)

Certificates and records are **render-time projections** assembled from:
- one pack (with its `fumigation_detail` jsonb)
- the related fumigant + methodology + their dosage ranges
- one `certificate_template` / `record_template` chosen on the pack

The frontend resolver shapes in `lib/fumigation-cert-print.js` and `lib/fumigation-record-print.js` define the canonical JSON the backend should expose:

```
GET  /api/packs/{id}/fumigation-certificate   → resolveFumigationCertificate model shape
GET  /api/packs/{id}/fumigation-record        → resolveFumigationRecord model shape
```

### `fumigation_certificate_issues`

Issued (saved) copies. Each row is a frozen snapshot so historical re-prints don't shift if master data changes.

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `pack_id` | integer FK → packs | |
| `issued_at` | timestamptz | ISO timestamp; also used as the URL `?issuedAt=` param |
| `issued_by` | varchar | Resolved from `authPayload.user.name` at issue time |
| `payload` | jsonb | Full frozen cert model (the shape returned by the resolver) |

```
POST /api/packs/{id}/fumigation-certificate/issues    → create issued copy
GET  /api/packs/{id}/fumigation-certificate/issues    → list (newest first)
GET  /api/packs/{id}/fumigation-certificate/issues/{issuedAt}  → get payload for re-print
```

### `fumigation_record_issues`

Same structure as `fumigation_certificate_issues` but for Records of Fumigation.

```
POST /api/packs/{id}/fumigation-record/issues
GET  /api/packs/{id}/fumigation-record/issues
GET  /api/packs/{id}/fumigation-record/issues/{issuedAt}
```

Frontend localStorage keys (until backend is live):
- `packing-ui-fumigation-certificate-issues` — array of `{ packId, issuedAt, issuedBy, payload }`
- `packing-ui-fumigation-record-issues` — same shape

---

## PEMS Integration

Full specification: [`docs/pems-backend-guide.md`](docs/pems-backend-guide.md) · SQL: [`docs/pems-schema.sql`](docs/pems-schema.sql)

**Strategy:** extend existing tables; new tables only for inspection submissions.

| Master data | Table | Key additions |
|---|---|---|
| Authorised Officers | `users` | `user_classifications[]`, existing `ao_*` fields |
| Establishments | `sites` | `establishment_number`, `yard_id`, structured address |
| RFP header | `packs` | `rfp_pack_type`, `rfp_total_quantity`, `rfp_quantity_unit`, `rfp_flow_path`, `original_rfp_number`, `rfp_refresh_snapshot` |
| Vendor config | `system_settings` | `pems_*` keys |

Transactional: `pack_pems_inspections`, containers, lines, time_entries, inspection_users, attachments, `reference_data_cache`, `integration_api_log`.

Frontend classifications (`lib/user-classifications.js`): `AUTHORISED_OFFICER`, `FUMIGATOR`, `PACKER`, `WEIGHBRIDGE`.
