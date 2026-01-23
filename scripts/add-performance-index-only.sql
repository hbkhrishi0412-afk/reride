-- ============================================================================
-- Add Performance Index ONLY (Safe for Existing Databases)
-- ============================================================================
-- This script adds ONLY the composite index needed for faster vehicle loading.
-- Safe to run even if you already have tables and other indexes.
-- It uses IF NOT EXISTS so it won't throw errors.
-- ============================================================================

-- Composite index for common query pattern: published vehicles sorted by created_at
-- This dramatically speeds up the most common query: fetching published vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_status_created_at ON vehicles(status, created_at DESC);

-- Verify the index was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'vehicles' 
        AND indexname = 'idx_vehicles_status_created_at'
    ) THEN
        RAISE NOTICE '✅ Performance index created successfully!';
        RAISE NOTICE '📊 This index will speed up queries for published vehicles.';
    ELSE
        RAISE NOTICE '⚠️  Index creation may have failed. Check Supabase logs.';
        RAISE NOTICE '💡 Make sure the vehicles table exists first.';
    END IF;
END $$;

-- ============================================================================
-- What this does:
-- ============================================================================
-- Creates an index on (status, created_at DESC) which allows the database
-- to quickly find published vehicles sorted by creation date.
-- 
-- This is the most common query pattern in your application, so this
-- single index will dramatically improve vehicle loading performance.
-- ============================================================================

