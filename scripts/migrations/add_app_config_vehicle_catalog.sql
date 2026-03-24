-- Stores admin vehicle dropdown JSON (categories / makes / models / variants).
-- API uses service_role and bypasses RLS. Listings remain in `vehicles`.
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE app_config IS 'Key-value app settings; vehicle_data = seller form dropdown catalog JSON';
