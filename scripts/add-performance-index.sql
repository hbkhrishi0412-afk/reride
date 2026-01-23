-- ============================================================================
-- Add Performance Index for Vehicle Loading
-- ============================================================================
-- This script adds ONLY the composite index needed for faster vehicle loading.
-- Safe to run even if index already exists (uses IF NOT EXISTS).
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
    ELSE
        RAISE NOTICE '⚠️  Index creation may have failed. Check Supabase logs.';
    END IF;
END $$;

