-- Optional: native FCM/APNs device token storage (Capacitor Push Notifications).
-- Run in Supabase SQL editor if you use server-driven push.

CREATE TABLE IF NOT EXISTS push_device_tokens (
  user_email TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_updated ON push_device_tokens (updated_at DESC);
