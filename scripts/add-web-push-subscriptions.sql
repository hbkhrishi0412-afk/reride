-- PWA Web Push subscriptions (VAPID). Run in Supabase SQL editor.
-- Pair with VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY on the API server.

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  subscription JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user ON web_push_subscriptions (user_email);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_updated ON web_push_subscriptions (updated_at DESC);

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies: manage centrally in scripts/enable-rls-production.sql if needed.
-- Service role (API) bypasses RLS for server-side push delivery.
