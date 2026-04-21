-- ============================================================================
-- Platform Settings + Audit Log (Supabase)
-- ============================================================================
-- Creates two tables used by the Admin Panel so that platform-wide settings
-- and administrative audit entries persist across sessions, browsers, and
-- devices instead of being confined to localStorage on a single machine.
--
-- Run this once in the Supabase SQL Editor (Production project).
-- The API uses the service-role key which bypasses RLS, so read/write access
-- from the server continues to work even with RLS enabled (no anon policies
-- are created — admin panel access goes through /api/* only).

-- ---------------------------------------------------------------------------
-- 1. platform_settings  (single-row key/value record keyed by 'singleton')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  id               TEXT         PRIMARY KEY DEFAULT 'singleton',
  "listingFee"     NUMERIC      NOT NULL    DEFAULT 25,
  "siteAnnouncement" TEXT,
  "updatedAt"      TIMESTAMPTZ              DEFAULT NOW(),
  "updatedBy"      TEXT
);

-- Seed the singleton row so GETs succeed before any admin has written.
INSERT INTO platform_settings (id, "listingFee", "siteAnnouncement")
VALUES ('singleton', 25, 'Welcome to ReRide! All EVs are 10% off this week.')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. audit_log  (append-only record of admin actions)
-- ---------------------------------------------------------------------------
-- `id` is the client-generated epoch-ms value produced by logAction() so that
-- we can keep the in-memory AuditLogEntry.id stable between local state and
-- the persisted row.
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGINT       PRIMARY KEY,
  timestamp    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actor        TEXT         NOT NULL,
  action       TEXT         NOT NULL,
  target       TEXT         NOT NULL,
  details      TEXT,
  "createdAt"  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor     ON audit_log (actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_action    ON audit_log (action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
