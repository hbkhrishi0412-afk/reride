-- Optional: native FCM/APNs device token storage (Capacitor Push Notifications).
-- Run in Supabase SQL editor if you use server-driven push.

CREATE TABLE IF NOT EXISTS push_device_tokens (
  user_email TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_updated ON push_device_tokens (updated_at DESC);

-- Required for API exposure in Supabase: lock data to the signed-in user only.
ALTER TABLE push_device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: the actual policies for this table are now managed centrally in
-- scripts/enable-rls-production.sql (look for section "10b. PUSH_DEVICE_TOKENS").
-- That script wraps every auth.jwt() call in (SELECT ...) to avoid the
-- "Auth RLS Initialization Plan" performance warning, and drops all legacy
-- policies ("Users can read own push token", etc.) before recreating them.
--
-- After creating the table, run scripts/enable-rls-production.sql once to apply
-- the policies.
