-- ============================================================================
-- Fix Function Search Path Security Issues
-- ============================================================================
-- This script fixes security vulnerabilities where functions have mutable
-- search_path, which can lead to SQL injection attacks.
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Fix update_updated_at_column function
-- ============================================================================
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
-- 2. Fix is_admin function (if it exists)
-- ============================================================================
-- Handle all overloads of the function
DO $$
DECLARE
    func_oid OID;
    func_sig TEXT;
BEGIN
    FOR func_oid IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'is_admin'
    LOOP
        -- Get function signature
        SELECT pg_get_function_identity_arguments(func_oid) INTO func_sig;
        
        -- Set search_path for this specific function overload
        EXECUTE format('ALTER FUNCTION public.is_admin(%s) SET search_path = public, pg_temp', func_sig);
        
        RAISE NOTICE '✅ Fixed is_admin function with signature: %', func_sig;
    END LOOP;
END $$;

-- ============================================================================
-- 3. Fix is_admin_by_email function (if it exists)
-- ============================================================================
DO $$
DECLARE
    func_oid OID;
    func_sig TEXT;
BEGIN
    FOR func_oid IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'is_admin_by_email'
    LOOP
        SELECT pg_get_function_identity_arguments(func_oid) INTO func_sig;
        EXECUTE format('ALTER FUNCTION public.is_admin_by_email(%s) SET search_path = public, pg_temp', func_sig);
        RAISE NOTICE '✅ Fixed is_admin_by_email function with signature: %', func_sig;
    END LOOP;
END $$;

-- ============================================================================
-- 4. Fix handle_new_user function (if it exists)
-- ============================================================================
DO $$
DECLARE
    func_oid OID;
    func_sig TEXT;
BEGIN
    FOR func_oid IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'handle_new_user'
    LOOP
        SELECT pg_get_function_identity_arguments(func_oid) INTO func_sig;
        EXECUTE format('ALTER FUNCTION public.handle_new_user(%s) SET search_path = public, pg_temp', func_sig);
        RAISE NOTICE '✅ Fixed handle_new_user function with signature: %', func_sig;
    END LOOP;
END $$;

-- ============================================================================
-- 5. Fix Extension in Public Schema (pg_trgm)
-- ============================================================================
-- Move pg_trgm extension from public schema to extensions schema
-- 
-- IMPORTANT: Moving an extension requires dropping and recreating it,
-- which will drop dependent objects (indexes, functions using it).
-- 
-- This script will:
-- 1. Check for dependencies before dropping
-- 2. Create extensions schema if needed
-- 3. Move the extension (if safe to do so)
--
-- If you have indexes or functions using pg_trgm, you'll need to
-- recreate them after moving the extension.

DO $$
DECLARE
    has_dependencies BOOLEAN := false;
    dep_count INTEGER;
BEGIN
    -- Create extensions schema if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_namespace WHERE nspname = 'extensions'
    ) THEN
        CREATE SCHEMA extensions;
        RAISE NOTICE '✅ Created extensions schema';
    END IF;
    
    -- Check if extension exists in public schema
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'pg_trgm'
        AND n.nspname = 'public'
    ) THEN
        -- Check for dependencies (indexes using pg_trgm)
        SELECT COUNT(*) INTO dep_count
        FROM pg_depend d
        JOIN pg_extension e ON d.refobjid = e.oid
        JOIN pg_class c ON d.objid = c.oid
        WHERE e.extname = 'pg_trgm'
        AND c.relkind IN ('i', 'r'); -- indexes and tables
        
        IF dep_count > 0 THEN
            has_dependencies := true;
            RAISE WARNING '⚠️  pg_trgm has % dependent objects. Manual migration required.', dep_count;
            RAISE NOTICE '';
            RAISE NOTICE 'To manually fix:';
            RAISE NOTICE '1. Note any indexes/functions using pg_trgm';
            RAISE NOTICE '2. DROP EXTENSION pg_trgm CASCADE;';
            RAISE NOTICE '3. CREATE EXTENSION pg_trgm SCHEMA extensions;';
            RAISE NOTICE '4. Recreate dependent indexes/functions';
        ELSE
            -- Safe to move - no dependencies
            BEGIN
                DROP EXTENSION pg_trgm;
                CREATE EXTENSION pg_trgm SCHEMA extensions;
                RAISE NOTICE '✅ Moved pg_trgm extension from public to extensions schema';
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '⚠️  Failed to move pg_trgm: %', SQLERRM;
                RAISE NOTICE 'You may need to manually move the extension';
            END;
        END IF;
    ELSE
        -- Check if it's already in extensions or another schema
        IF EXISTS (
            SELECT 1 FROM pg_extension e
            JOIN pg_namespace n ON e.extnamespace = n.oid
            WHERE e.extname = 'pg_trgm'
            AND n.nspname != 'public'
        ) THEN
            RAISE NOTICE '✅ pg_trgm is not in public schema (already fixed)';
        ELSE
            RAISE NOTICE 'ℹ️  pg_trgm extension not found';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- Alternative: If you cannot drop pg_trgm (due to dependencies),
-- you can create it in extensions schema and update search_path for functions
-- ============================================================================
-- If the above fails due to dependencies, use this approach instead:
/*
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Create pg_trgm in extensions schema (if not already there)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Update search_path for all functions that might use pg_trgm
-- This is a safer approach that doesn't drop the extension
*/

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
    func_count INTEGER;
    ext_schema TEXT;
BEGIN
    -- Check functions with proper search_path
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('update_updated_at_column', 'is_admin', 'is_admin_by_email', 'handle_new_user')
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%';
    
    RAISE NOTICE '✅ Functions with search_path configured: %', func_count;
    
    -- Check pg_trgm extension location
    SELECT n.nspname INTO ext_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_trgm'
    LIMIT 1;
    
    IF ext_schema IS NOT NULL THEN
        IF ext_schema = 'extensions' THEN
            RAISE NOTICE '✅ pg_trgm extension is in extensions schema';
        ELSE
            RAISE NOTICE '⚠️  pg_trgm extension is in % schema (should be in extensions)', ext_schema;
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  pg_trgm extension not found';
    END IF;
    
    RAISE NOTICE '✅ Security fixes applied!';
END $$;

