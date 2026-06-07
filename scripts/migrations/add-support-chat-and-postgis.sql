-- Support chat (replaces MongoDB ChatMessage / ChatSession) + PostGIS vehicle geo search
-- Apply in Supabase Dashboard → SQL Editor

-- ── PostGIS + vehicle coordinates ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS geo geography(POINT, 4326);

UPDATE vehicles
SET
  latitude = NULLIF(metadata->'exactLocation'->>'lat', '')::double precision,
  longitude = NULLIF(metadata->'exactLocation'->>'lng', '')::double precision
WHERE metadata ? 'exactLocation'
  AND (latitude IS NULL OR longitude IS NULL);

UPDATE vehicles
SET geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND geo IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_geo ON vehicles USING GIST (geo);

CREATE OR REPLACE FUNCTION sync_vehicle_geo_from_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.metadata ? 'exactLocation' THEN
    NEW.latitude := NULLIF(NEW.metadata->'exactLocation'->>'lat', '')::double precision;
    NEW.longitude := NULLIF(NEW.metadata->'exactLocation'->>'lng', '')::double precision;
  END IF;
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.geo := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_vehicle_geo ON vehicles;
CREATE TRIGGER trg_sync_vehicle_geo
  BEFORE INSERT OR UPDATE OF metadata, latitude, longitude ON vehicles
  FOR EACH ROW EXECUTE FUNCTION sync_vehicle_geo_from_metadata();

CREATE OR REPLACE FUNCTION vehicles_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  max_results INTEGER DEFAULT 100
)
RETURNS SETOF vehicles
LANGUAGE sql
STABLE
AS $$
  SELECT v.*
  FROM vehicles v
  WHERE v.status = 'published'
    AND v.geo IS NOT NULL
    AND ST_DWithin(
      v.geo,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      LEAST(GREATEST(radius_km, 0.5), 50) * 1000
    )
  ORDER BY v.created_at DESC
  LIMIT LEAST(GREATEST(max_results, 1), 100);
$$;

-- ── Support chat tables ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_chat_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL DEFAULT 'Guest',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES support_chat_sessions(session_id) ON DELETE CASCADE,
  user_id TEXT,
  user_name TEXT,
  message TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'bot', 'admin')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_session_created
  ON support_chat_messages (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_chat_sessions_user
  ON support_chat_sessions (user_id, last_message_at DESC);

ALTER TABLE support_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_chat_sessions_service ON support_chat_sessions;
CREATE POLICY support_chat_sessions_service ON support_chat_sessions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS support_chat_messages_service ON support_chat_messages;
CREATE POLICY support_chat_messages_service ON support_chat_messages
  FOR ALL USING (auth.role() = 'service_role');
