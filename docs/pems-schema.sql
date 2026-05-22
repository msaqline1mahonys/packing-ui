-- PEMS Schema — extend existing tables + new transactional tables only
-- PostgreSQL syntax. Reversible via docs/pems-schema-rollback.sql

-- =============================================================================
-- EXTEND: users (replaces pems_ao_tokens)
-- PEMS Audit: users table already exists — added user_classifications + sync AO columns
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_classifications text[] NOT NULL DEFAULT '{}';

-- AO columns may already exist under camelCase in API; use snake_case in DB:
ALTER TABLE users ADD COLUMN IF NOT EXISTS ao_token varchar(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ao_number varchar(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ao_pems_username varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ao_pems_password varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ao_expiry date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ao_license_number varchar(50);

-- Legacy booleans (keep — sync from user_classifications):
-- ao_active, is_fumigator, weighbridge_access, packers_account_access

CREATE INDEX IF NOT EXISTS idx_users_classifications ON users USING GIN (user_classifications);

-- =============================================================================
-- EXTEND: sites (replaces pems_establishments)
-- PEMS Audit: sites table already exists — added PEMS establishment columns
-- =============================================================================

ALTER TABLE sites ADD COLUMN IF NOT EXISTS establishment_number varchar(50);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS yard_id integer;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address_line1 varchar(255);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address_line2 varchar(255);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS suburb varchar(100);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS state_code varchar(10);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS postcode varchar(10);

-- =============================================================================
-- EXTEND: packs (replaces pems_rfp_records)
-- PEMS Audit: packs table already exists — added RFP/PEMS header columns
-- =============================================================================

ALTER TABLE packs ADD COLUMN IF NOT EXISTS rfp_pack_type varchar(100);
ALTER TABLE packs ADD COLUMN IF NOT EXISTS rfp_total_quantity decimal(15,4);
ALTER TABLE packs ADD COLUMN IF NOT EXISTS rfp_quantity_unit varchar(20);
ALTER TABLE packs ADD COLUMN IF NOT EXISTS rfp_flow_path varchar(50);
ALTER TABLE packs ADD COLUMN IF NOT EXISTS original_rfp_number varchar(50);
ALTER TABLE packs ADD COLUMN IF NOT EXISTS rfp_refresh_snapshot jsonb;

-- =============================================================================
-- EXTEND: system_settings (replaces pems_vendor_config + pems_system_settings)
-- PEMS Audit: created keys in system_settings — did not create pems_vendor_config
-- =============================================================================

INSERT INTO system_settings (key, value, description, updated_at) VALUES
  ('pems_active_environment', 'vendor_test', 'vendor_test or production', now()),
  ('pems_vendor_token', '', 'Encrypted vendor token', now()),
  ('pems_installation_username', '', 'Encrypted installation username', now()),
  ('pems_installation_password', '', 'Encrypted installation password', now()),
  ('pems_org_name_prefix', '', 'CorrelationId prefix e.g. ACME', now()),
  ('pems_client_reference_system', '', 'Max 50 chars alphanumeric + hyphens', now()),
  ('pems_base_url', '', 'Override base URL; empty = derive from environment', now()),
  ('pems_submission_enabled', 'false', 'Must be true for live SOAP submissions', now()),
  ('pems_reference_data_cache_ttl_hours', '24', 'Reference cache TTL', now()),
  ('pems_max_attachment_size_mb', '10', 'Max attachment size MB', now()),
  ('pems_allowed_mime_types', 'application/pdf,image/jpeg,image/png', 'Allowed MIME types', now())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- NEW: pack_pems_inspections (was pems_inspections)
-- PEMS Audit: created new table pack_pems_inspections — did not exist
-- =============================================================================

CREATE TABLE IF NOT EXISTS pack_pems_inspections (
  id bigserial PRIMARY KEY,
  pems_inspection_id varchar(100),
  pack_id bigint NOT NULL REFERENCES packs(id),
  site_id bigint NOT NULL REFERENCES sites(id),
  inspection_type varchar(20) NOT NULL,
  inspection_reason varchar(5),
  inspections_to_be_cancelled text,
  parent_inspection_id bigint REFERENCES pack_pems_inspections(id),
  submitted_by_user_id bigint REFERENCES users(id),
  inspection_start_datetime timestamptz NOT NULL,
  inspection_end_datetime timestamptz NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'draft',
  pems_status varchar(30),
  correlation_id varchar(50),
  submission_payload text,
  submission_response text,
  submission_error text,
  submitted_at timestamptz,
  expiry_date date,
  additional_declaration text,
  trade_desc_required_for_goods varchar(1),
  trade_desc_physically_applied varchar(1),
  trade_desc_requirement_meet varchar(5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_pems_inspections_pack_id ON pack_pems_inspections(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_pems_inspections_site_id ON pack_pems_inspections(site_id);

-- =============================================================================
-- NEW: pack_pems_inspection_containers
-- =============================================================================

CREATE TABLE IF NOT EXISTS pack_pems_inspection_containers (
  id bigserial PRIMARY KEY,
  inspection_id bigint NOT NULL REFERENCES pack_pems_inspections(id) ON DELETE CASCADE,
  pack_container_id bigint,
  container_number varchar(20) NOT NULL,
  inspection_level_code varchar(20),
  inspection_result_code varchar(20),
  seal_number varchar(50),
  passed_after_rectification varchar(1),
  inspection_remark_code varchar(50),
  inspected_by_user_id bigint REFERENCES users(id),
  container_result varchar(20),
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_pems_insp_containers_inspection ON pack_pems_inspection_containers(inspection_id);

-- =============================================================================
-- NEW: pack_pems_inspection_lines
-- =============================================================================

CREATE TABLE IF NOT EXISTS pack_pems_inspection_lines (
  id bigserial PRIMARY KEY,
  inspection_id bigint NOT NULL REFERENCES pack_pems_inspections(id) ON DELETE CASCADE,
  container_id bigint NOT NULL REFERENCES pack_pems_inspection_containers(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  commodity varchar(100),
  source varchar(100),
  package_number integer,
  package_type varchar(50),
  package_unit varchar(20),
  weight decimal(15,4),
  weight_unit varchar(20),
  sampled varchar(10),
  result varchar(20),
  inspection_remark_code varchar(50),
  inspected_by_user_id bigint REFERENCES users(id),
  sampling_rate decimal(10,4),
  sampling_type varchar(5),
  inline_sampling_type varchar(5),
  sub_package_type varchar(20),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- NEW: pack_pems_time_entries
-- =============================================================================

CREATE TABLE IF NOT EXISTS pack_pems_time_entries (
  id bigserial PRIMARY KEY,
  inspection_id bigint NOT NULL REFERENCES pack_pems_inspections(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id),
  activity_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  activity_type_code varchar(50) NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- NEW: pack_pems_inspection_users (associated AOs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pack_pems_inspection_users (
  id bigserial PRIMARY KEY,
  inspection_id bigint NOT NULL REFERENCES pack_pems_inspections(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id),
  UNIQUE (inspection_id, user_id)
);

-- =============================================================================
-- NEW: pack_pems_attachments
-- =============================================================================

CREATE TABLE IF NOT EXISTS pack_pems_attachments (
  id bigserial PRIMARY KEY,
  inspection_id bigint NOT NULL REFERENCES pack_pems_inspections(id) ON DELETE CASCADE,
  document_name varchar(255) NOT NULL,
  attachment_type varchar(20) NOT NULL,
  import_permit_number varchar(100),
  mime_type varchar(100) NOT NULL,
  file_path varchar(500) NOT NULL,
  pems_upload_status varchar(50),
  submitted_by_user_id bigint REFERENCES users(id),
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- NEW: reference_data_cache (generic — was pems_reference_data_cache)
-- =============================================================================

CREATE TABLE IF NOT EXISTS reference_data_cache (
  id bigserial PRIMARY KEY,
  source varchar(50) NOT NULL DEFAULT 'PEMS',
  ref_type varchar(100) NOT NULL,
  code varchar(100) NOT NULL,
  description varchar(500),
  start_date date,
  end_date date,
  cached_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, ref_type, code)
);

-- =============================================================================
-- NEW: integration_api_log (generic — was pems_submission_log)
-- =============================================================================

CREATE TABLE IF NOT EXISTS integration_api_log (
  id bigserial PRIMARY KEY,
  integration varchar(50) NOT NULL DEFAULT 'PEMS',
  inspection_id bigint REFERENCES pack_pems_inspections(id),
  service_name varchar(100) NOT NULL,
  endpoint_url varchar(500) NOT NULL,
  correlation_id varchar(50),
  request_payload text,
  response_payload text,
  http_status integer,
  fault_code varchar(50),
  fault_reason varchar(100),
  fault_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_api_log_inspection ON integration_api_log(inspection_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_log_integration ON integration_api_log(integration);
