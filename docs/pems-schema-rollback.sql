-- PEMS Schema Rollback — drop in reverse FK order

DROP TABLE IF EXISTS integration_api_log;
DROP TABLE IF EXISTS reference_data_cache;
DROP TABLE IF EXISTS pack_pems_attachments;
DROP TABLE IF EXISTS pack_pems_inspection_users;
DROP TABLE IF EXISTS pack_pems_time_entries;
DROP TABLE IF EXISTS pack_pems_inspection_lines;
DROP TABLE IF EXISTS pack_pems_inspection_containers;
DROP TABLE IF EXISTS pack_pems_inspections;

DELETE FROM system_settings WHERE key LIKE 'pems_%';

ALTER TABLE packs DROP COLUMN IF EXISTS rfp_refresh_snapshot;
ALTER TABLE packs DROP COLUMN IF EXISTS original_rfp_number;
ALTER TABLE packs DROP COLUMN IF EXISTS rfp_flow_path;
ALTER TABLE packs DROP COLUMN IF EXISTS rfp_quantity_unit;
ALTER TABLE packs DROP COLUMN IF EXISTS rfp_total_quantity;
ALTER TABLE packs DROP COLUMN IF EXISTS rfp_pack_type;

ALTER TABLE sites DROP COLUMN IF EXISTS postcode;
ALTER TABLE sites DROP COLUMN IF EXISTS state_code;
ALTER TABLE sites DROP COLUMN IF EXISTS suburb;
ALTER TABLE sites DROP COLUMN IF EXISTS address_line2;
ALTER TABLE sites DROP COLUMN IF EXISTS address_line1;
ALTER TABLE sites DROP COLUMN IF EXISTS yard_id;
ALTER TABLE sites DROP COLUMN IF EXISTS establishment_number;

DROP INDEX IF EXISTS idx_users_classifications;
ALTER TABLE users DROP COLUMN IF EXISTS user_classifications;
