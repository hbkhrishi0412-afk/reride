-- ============================================================================
-- Complete Supabase Schema Fix for Firebase Migration
-- ============================================================================
-- This script fixes all known schema issues for Firebase to Supabase migration
-- Run this in Supabase SQL Editor before running the migration script
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE - Add password column
-- ============================================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password TEXT;

COMMENT ON COLUMN users.password IS 'Bcrypt hashed password for email/password authentication. NULL for OAuth-only users.';

-- ============================================================================
-- 2. CONVERSATIONS TABLE - Add missing columns
-- ============================================================================
-- Add seller_name column (required for migration)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS seller_name TEXT;

-- Add last_message column (required for migration)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_message TEXT;

-- Add flagged_at column (optional, for flagging conversations)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

-- Add metadata column (required for storing messages array)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ============================================================================
-- 3. NOTIFICATIONS TABLE - Add missing columns and fix constraints
-- ============================================================================
-- Add read column (required for migration)
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Add metadata column (optional, for storing additional data)
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Make user_id nullable (some notifications may not have a user_id)
-- This allows notifications without user_id to be migrated
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'user_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END $$;

-- Make type nullable (some notifications may not have a type)
-- This allows notifications without type to be migrated
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'type' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN type DROP NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- 4. SERVICE_PROVIDERS TABLE - Create if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_providers (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    services TEXT[],
    rating NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS (Row Level Security) for service_providers
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_service_providers_email ON service_providers(email);
CREATE INDEX IF NOT EXISTS idx_service_providers_location ON service_providers(location);
CREATE INDEX IF NOT EXISTS idx_service_providers_rating ON service_providers(rating);

-- ============================================================================
-- 5. SERVICE_REQUESTS TABLE - Create if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    provider_id TEXT,
    service_type TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS (Row Level Security)
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);

-- ============================================================================
-- 6. NEW_CARS TABLE - Create if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS new_cars (
    id TEXT PRIMARY KEY,
    brand_name TEXT,
    model_name TEXT,
    model_year INTEGER,
    price NUMERIC,
    images TEXT[],
    features TEXT[],
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS (Row Level Security)
ALTER TABLE new_cars ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_new_cars_brand_name ON new_cars(brand_name);
CREATE INDEX IF NOT EXISTS idx_new_cars_model_name ON new_cars(model_name);
CREATE INDEX IF NOT EXISTS idx_new_cars_model_year ON new_cars(model_year);

-- ============================================================================
-- 7. PLANS TABLE - Create if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT,
    price NUMERIC DEFAULT 0,
    duration TEXT,
    features TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS (Row Level Security)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_price ON plans(price);

-- ============================================================================
-- 8. VERIFICATION - Check that all required tables and columns exist
-- ============================================================================
DO $$
DECLARE
    missing_items TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check users table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        missing_items := array_append(missing_items, 'users table');
    END IF;
    
    -- Check users.password column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        missing_items := array_append(missing_items, 'users.password column');
    END IF;
    
    -- Check conversations table columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'seller_name'
    ) THEN
        missing_items := array_append(missing_items, 'conversations.seller_name column');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'last_message'
    ) THEN
        missing_items := array_append(missing_items, 'conversations.last_message column');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'metadata'
    ) THEN
        missing_items := array_append(missing_items, 'conversations.metadata column');
    END IF;
    
    -- Check notifications table columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'read'
    ) THEN
        missing_items := array_append(missing_items, 'notifications.read column');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'metadata'
    ) THEN
        missing_items := array_append(missing_items, 'notifications.metadata column');
    END IF;
    
    -- Check service_providers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_providers') THEN
        missing_items := array_append(missing_items, 'service_providers table');
    END IF;
    
    -- Check service_requests table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_requests') THEN
        missing_items := array_append(missing_items, 'service_requests table');
    END IF;
    
    -- Check new_cars table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'new_cars') THEN
        missing_items := array_append(missing_items, 'new_cars table');
    END IF;
    
    -- Check plans table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans') THEN
        missing_items := array_append(missing_items, 'plans table');
    END IF;
    
    -- Report results
    IF array_length(missing_items, 1) > 0 THEN
        RAISE NOTICE '⚠️  Some items could not be created: %', array_to_string(missing_items, ', ');
    ELSE
        RAISE NOTICE '✅ All schema fixes applied successfully!';
    END IF;
END $$;

-- ============================================================================
-- 9. OPTIONAL: RLS Policies (commented out - uncomment after migration)
-- ============================================================================
-- These policies can be added after migration for production use

-- Service Providers RLS Policies:
-- 
-- -- Allow public read access to service providers
-- CREATE POLICY "Service providers are viewable by everyone" ON service_providers
--   FOR SELECT USING (true);
-- 
-- -- Only authenticated users can insert service providers
-- CREATE POLICY "Authenticated users can insert service providers" ON service_providers
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- 
-- -- Only service providers can update their own records
-- CREATE POLICY "Service providers can update own records" ON service_providers
--   FOR UPDATE USING (auth.uid()::text = id);

-- Service Requests RLS Policies:
-- 
-- -- Users can read their own service requests
-- CREATE POLICY "Users can read own service requests" ON service_requests
--   FOR SELECT USING (auth.uid()::text = user_id);
-- 
-- -- Service providers can read requests assigned to them
-- CREATE POLICY "Providers can read assigned requests" ON service_requests
--   FOR SELECT USING (auth.uid()::text = provider_id);
-- 
-- -- Users can create their own service requests
-- CREATE POLICY "Users can create service requests" ON service_requests
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id);
-- 
-- -- Users can update their own service requests
-- CREATE POLICY "Users can update own service requests" ON service_requests
--   FOR UPDATE USING (auth.uid()::text = user_id);

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- Next steps:
-- 1. Verify all tables and columns exist in Supabase Dashboard
-- 2. Run the migration script: npm run migrate:firebase-to-supabase
-- 3. After migration, configure RLS policies for production
-- ============================================================================

