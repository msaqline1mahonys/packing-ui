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

- `INTERNAL_ACCOUNT_ROWS`
  - Keys: `id`, `name`, `description`, `shrinkApplied`, `shrinkReceivalAccount`
  - Special rule: only one row can be `shrinkReceivalAccount = true`

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

- `GENERAL_TRANSPORT_PRICE_ROWS`
  - Keys: `transporterId`, `containerSize`, `lineItemDescription`, `price`
  - Suggested unique key: `(transporter_id, container_size, line_item_description)`

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
