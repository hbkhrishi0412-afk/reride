-- ============================================================================
-- BUYER ACTIVITY TABLE
-- ============================================================================
-- Stores buyer activity data including recently viewed vehicles, saved searches,
-- and price drop notifications. This enables cross-device synchronization.
-- ============================================================================

CREATE TABLE IF NOT EXISTS buyer_activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    recently_viewed INTEGER[], -- Array of vehicle IDs
    saved_searches JSONB, -- Array of saved search objects
    price_drops INTEGER[], -- Array of vehicle IDs with price drops
    new_matches JSONB, -- Array of new match notifications
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist
ALTER TABLE buyer_activity ADD COLUMN IF NOT EXISTS recently_viewed INTEGER[];
ALTER TABLE buyer_activity ADD COLUMN IF NOT EXISTS saved_searches JSONB;
ALTER TABLE buyer_activity ADD COLUMN IF NOT EXISTS price_drops INTEGER[];
ALTER TABLE buyer_activity ADD COLUMN IF NOT EXISTS new_matches JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_buyer_activity_user_id ON buyer_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_activity_updated_at ON buyer_activity(updated_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE buyer_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own buyer activity
-- Drop policies if they exist to allow re-running the script
DROP POLICY IF EXISTS "Users can read own buyer activity" ON buyer_activity;
DROP POLICY IF EXISTS "Users can insert own buyer activity" ON buyer_activity;
DROP POLICY IF EXISTS "Users can update own buyer activity" ON buyer_activity;

-- SELECT: Users can read their own buyer activity
CREATE POLICY "Users can read own buyer activity" ON buyer_activity
    FOR SELECT
    USING ((select auth.uid())::text = user_id);

-- INSERT: Users can insert their own buyer activity
CREATE POLICY "Users can insert own buyer activity" ON buyer_activity
    FOR INSERT
    WITH CHECK ((select auth.uid())::text = user_id);

-- UPDATE: Users can update their own buyer activity
CREATE POLICY "Users can update own buyer activity" ON buyer_activity
    FOR UPDATE
    USING ((select auth.uid())::text = user_id)
    WITH CHECK ((select auth.uid())::text = user_id);

-- Auto-update updated_at timestamp
-- SECURITY: Set search_path to prevent SQL injection vulnerabilities
CREATE OR REPLACE FUNCTION update_buyer_activity_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Drop trigger if it exists to allow re-running the script
DROP TRIGGER IF EXISTS buyer_activity_updated_at ON buyer_activity;
CREATE TRIGGER buyer_activity_updated_at
    BEFORE UPDATE ON buyer_activity
    FOR EACH ROW
    EXECUTE FUNCTION update_buyer_activity_updated_at();

