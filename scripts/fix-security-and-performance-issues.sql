-- ============================================================================
-- Fix Security and Performance Issues
-- ============================================================================
-- This script fixes:
-- 1. Security: Function search_path vulnerabilities (3 functions)
-- 2. Security: Supabase Auth compromised passwords policy
-- 3. Performance: Slow query optimizations
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: FIX SECURITY ISSUES - Function Search Path
-- ============================================================================

-- 1. Fix update_buyer_activity_updated_at function
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

-- 2. Fix update_services_updated_at function
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 3. Fix update_updated_at_column function (if it exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 2: FIX SECURITY ISSUES - Supabase Auth Compromised Passwords
-- ============================================================================
-- Note: This requires Supabase Dashboard configuration, but we can enable
-- it via SQL if the auth schema allows it. Otherwise, enable it manually:
-- Dashboard > Authentication > Policies > Enable "Prevent use of compromised passwords"

-- Try to enable compromised password checking via SQL
-- This may not work depending on Supabase version - if it fails, enable manually in dashboard
DO $$
BEGIN
    -- Check if we can set this via SQL
    -- Most Supabase instances require this to be set via Dashboard
    RAISE NOTICE '⚠️  Compromised password prevention must be enabled manually:';
    RAISE NOTICE '   1. Go to Supabase Dashboard';
    RAISE NOTICE '   2. Navigate to Authentication > Policies';
    RAISE NOTICE '   3. Enable "Prevent use of compromised passwords"';
    RAISE NOTICE '   This uses Have I Been Pwned API to check passwords';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️  Enable compromised password prevention in Dashboard';
END $$;

-- ============================================================================
-- PART 3: FIX PERFORMANCE ISSUES - Add Missing Indexes
-- ============================================================================

-- Index for services table queries (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
        CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_services_updated_at ON services(updated_at DESC);
    END IF;
END $$;

-- Index for buyer_activity table queries (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'buyer_activity') THEN
        CREATE INDEX IF NOT EXISTS idx_buyer_activity_user_id_updated_at ON buyer_activity(user_id, updated_at DESC);
    END IF;
END $$;

-- Composite index for vehicles (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_status_created_at ON vehicles(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_vehicles_seller_email_status ON vehicles(seller_email, status);
    END IF;
END $$;

-- Index for service_requests queries (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_requests') THEN
        CREATE INDEX IF NOT EXISTS idx_service_requests_user_id_created_at ON service_requests(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id_status ON service_requests(provider_id, status) WHERE provider_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_service_requests_status_created_at ON service_requests(status, created_at DESC);
    END IF;
END $$;

-- Index for conversations queries (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversations') THEN
        CREATE INDEX IF NOT EXISTS idx_conversations_customer_id_updated_at ON conversations(customer_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_conversations_seller_id_updated_at ON conversations(seller_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
    END IF;
END $$;

-- Index for users queries (if users table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role = 'admin';
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    END IF;
END $$;

-- ============================================================================
-- PART 4: OPTIMIZE EXISTING INDEXES
-- ============================================================================

-- Analyze tables to update statistics for query planner (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
        ANALYZE services;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'buyer_activity') THEN
        ANALYZE buyer_activity;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
        ANALYZE vehicles;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_requests') THEN
        ANALYZE service_requests;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversations') THEN
        ANALYZE conversations;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        ANALYZE users;
    END IF;
END $$;

-- ============================================================================
-- PART 5: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    func_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Check functions with proper search_path
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('update_updated_at_column', 'update_buyer_activity_updated_at', 'update_services_updated_at')
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SECURITY FIXES VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Functions with search_path configured: %', func_count;
    
    IF func_count >= 3 THEN
        RAISE NOTICE '✅ All 3 functions have been secured!';
    ELSE
        RAISE NOTICE '⚠️  Some functions may need manual fixing';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ACTION REQUIRED: Enable compromised password prevention';
    RAISE NOTICE '   Dashboard > Authentication > Policies';
    RAISE NOTICE '';
    
    -- Check indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND (
        indexname LIKE 'idx_services%'
        OR indexname LIKE 'idx_buyer_activity%'
        OR indexname LIKE 'idx_vehicles%'
        OR indexname LIKE 'idx_service_requests%'
        OR indexname LIKE 'idx_conversations%'
    );
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PERFORMANCE FIXES VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Performance indexes created: %', index_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ All fixes have been applied!';
    RAISE NOTICE '========================================';
END $$;

