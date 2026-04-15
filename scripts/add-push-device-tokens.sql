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
ALTER TABLE push_device_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own push token" ON push_device_tokens;
CREATE POLICY "Users can read own push token"
  ON push_device_tokens
  FOR SELECT
  TO authenticated
  USING (LOWER(user_email) = LOWER(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Users can insert own push token" ON push_device_tokens;
CREATE POLICY "Users can insert own push token"
  ON push_device_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (LOWER(user_email) = LOWER(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Users can update own push token" ON push_device_tokens;
CREATE POLICY "Users can update own push token"
  ON push_device_tokens
  FOR UPDATE
  TO authenticated
  USING (LOWER(user_email) = LOWER(auth.jwt() ->> 'email'))
  WITH CHECK (LOWER(user_email) = LOWER(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Users can delete own push token" ON push_device_tokens;
CREATE POLICY "Users can delete own push token"
  ON push_device_tokens
  FOR DELETE
  TO authenticated
  USING (LOWER(user_email) = LOWER(auth.jwt() ->> 'email'));
