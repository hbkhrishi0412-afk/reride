-- Create service_requests table in Supabase if it doesn't exist
-- Run this in Supabase SQL Editor before running the migration

CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  provider_id TEXT,
  service_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Enable RLS (Row Level Security)
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Note: The service_role key used by the migration script automatically bypasses RLS
-- After migration, you can add proper RLS policies for production use:

-- Example RLS policies (uncomment after migration):
-- 
-- -- Users can read their own service requests
-- CREATE POLICY "Users can read own service requests" ON service_requests
--   FOR SELECT USING (auth.uid()::text = user_id);
-- 
-- -- Service providers can read requests assigned to them
-- CREATE POLICY "Providers can read assigned requests" ON service_requests
--   FOR SELECT USING (auth.uid()::text = provider_id);
-- 
-- -- Users can create their own service requests
-- CREATE POLICY "Users can create service requests" ON service_requests
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id);
-- 
-- -- Users can update their own service requests
-- CREATE POLICY "Users can update own service requests" ON service_requests
--   FOR UPDATE USING (auth.uid()::text = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);















