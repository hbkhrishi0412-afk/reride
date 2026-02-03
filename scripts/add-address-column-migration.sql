-- ============================================================================
-- Migration Script: Add Address Column to Users Table
-- ============================================================================
-- This script adds the 'address' column to the existing users table in Supabase
-- Run this in Supabase SQL Editor if you have an existing database
-- ============================================================================

-- Add address column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comment to document the column
COMMENT ON COLUMN users.address IS 'Full address including street, city, state, and postal code';

-- Optional: Create index on address for search functionality (if needed)
-- CREATE INDEX IF NOT EXISTS idx_users_address ON users USING gin(to_tsvector('english', address));

-- ============================================================================
-- Verification: Check that the column was added successfully
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'address'
    ) THEN
        RAISE NOTICE '✅ Address column added successfully to users table!';
    ELSE
        RAISE NOTICE '⚠️  Address column could not be added. Please check manually.';
    END IF;
END $$;

-- ============================================================================
-- Migration Complete!
-- ============================================================================






