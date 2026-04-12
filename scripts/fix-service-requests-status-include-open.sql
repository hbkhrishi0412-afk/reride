-- Align service_requests.status with app usage: new requests use 'open' (not only 'pending').
-- Run in Supabase SQL editor if your CHECK constraint blocks 'open'.

-- 1) Drop old check if present (name may vary; adjust if migration fails)
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;

-- 2) Allow statuses used by the app
ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('open', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'));

-- 3) Default new rows to 'open' (matches API)
ALTER TABLE service_requests ALTER COLUMN status SET DEFAULT 'open';
