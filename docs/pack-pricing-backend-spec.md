# General Pack Pricing - Backend Specification

This document defines the backend model and API contract for General Pack Pricing where pricing is configured by **container size** (not ISO code).

## Scope and Rules

- Pricing dimensions:
  - Base price: `commodity_type + container_size`
  - Override price: `customer + commodity_type + container_size`
- Multiple ISO codes may map to the same size (for example, `22G1` and `22R1` -> `20FT`).
- Pricing logic must use size only; ISO is reference metadata.
- Price resolution order:
  1. Customer override
  2. Base commodity-type price
  3. Null/unset if neither exists

## Container Size Normalization

Normalize container size before storing/comparing:

- Uppercase
- Trim whitespace
- Remove internal spaces

Examples:

- `20ft` -> `20FT`
- `20 FT` -> `20FT`
- ` 40ft ` -> `40FT`

Suggested shared helper: `normalize_size_code(input)`.

## Database Tables

### 1) `container_codes` (reference)

```sql
CREATE TABLE container_codes (
  id BIGSERIAL PRIMARY KEY,
  iso_code VARCHAR(10) NOT NULL UNIQUE,
  size_code VARCHAR(10) NOT NULL,
  description TEXT,
  cubic_meters NUMERIC(10,3),
  average_weight_t NUMERIC(10,3),
  max_weight_t NUMERIC(10,3),
  average_empty_tare_t NUMERIC(10,3),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_container_codes_size_code ON container_codes (size_code);
```

### 2) `pack_price_base` (commodity type base price)

```sql
CREATE TABLE pack_price_base (
  id BIGSERIAL PRIMARY KEY,
  commodity_type_id BIGINT NOT NULL REFERENCES commodity_types(id),
  size_code VARCHAR(10) NOT NULL,
  price_per_ton_ex_gst NUMERIC(12,2) NOT NULL CHECK (price_per_ton_ex_gst >= 0),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'AUD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX uq_pack_price_base_current
  ON pack_price_base (commodity_type_id, size_code)
  WHERE is_active = TRUE AND effective_to IS NULL;
```

### 3) `pack_price_customer_override` (customer override)

```sql
CREATE TABLE pack_price_customer_override (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  commodity_type_id BIGINT NOT NULL REFERENCES commodity_types(id),
  size_code VARCHAR(10) NOT NULL,
  price_per_ton_ex_gst NUMERIC(12,2) NOT NULL CHECK (price_per_ton_ex_gst >= 0),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'AUD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX uq_pack_price_override_current
  ON pack_price_customer_override (customer_id, commodity_type_id, size_code)
  WHERE is_active = TRUE AND effective_to IS NULL;
```

## API Contract

### `GET /api/container-codes/sizes`

Returns unique active size list (derived from `container_codes`).

```json
{
  "sizes": ["20FT", "40FT", "45FT"]
}
```

### `GET /api/pack-pricing?commodityTypeId={id}`

Returns all pricing data for one commodity type.

```json
{
  "commodityTypeId": 2,
  "sizes": ["20FT", "40FT"],
  "basePricesBySize": {
    "20FT": 102.5,
    "40FT": 180.0
  },
  "customerOverridesByCustomerId": {
    "1": { "20FT": 91.25, "40FT": null },
    "2": { "20FT": null, "40FT": 176.0 }
  }
}
```

### `PUT /api/pack-pricing/base`

Upserts base prices for one commodity type.

```json
{
  "commodityTypeId": 2,
  "pricesBySize": {
    "20FT": 102.5,
    "40FT": 180.0
  }
}
```

Behavior:

- Missing or `null` value clears current active base row for that size (or end-dates it).

### `PUT /api/pack-pricing/customer-override`

Upserts customer override prices.

```json
{
  "customerId": 1,
  "commodityTypeId": 2,
  "pricesBySize": {
    "20FT": 91.25,
    "40FT": null
  }
}
```

Behavior:

- `null` clears override so resolution falls back to base price.

## Validation Requirements

- Reject unknown/inactive `size_code` values not present in `container_codes`.
- Reject negative prices.
- Normalize `size_code` before DB write and before uniqueness checks.
- Enforce single active current row per key with partial unique indexes.

## Price Resolution Query (Current Price)

Inputs: `customer_id`, `commodity_type_id`, `size_code`

1. Fetch active override row for `(customer_id, commodity_type_id, size_code)`.
2. If not found, fetch active base row for `(commodity_type_id, size_code)`.
3. Return:
   - resolved price
   - source (`override` or `base`)
   - null if neither exists

## Migration Guidance

- Backfill `container_codes` first.
- Migrate existing pricing by normalizing `containerSize` -> `size_code`.
- During cutover, make old pricing write paths read-only.
- Add compatibility mapper if legacy data contains mixed size formats.

## Frontend Alignment

Frontend is configured to:

- Derive size columns dynamically from Container Codes
- De-duplicate sizes across multiple ISO codes
- Store and compare prices by normalized size
- Ignore ISO codes during pricing entry
