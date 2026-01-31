-- ============================================================================
-- Fix RLS Policies for Users Table - Allow Admins to Read All Users
-- ============================================================================
-- This script creates RLS policies that allow admins to read all users
-- which is required for the admin panel to display user data.
--
-- IMPORTANT NOTES:
-- 1. If your API uses SUPABASE_SERVICE_ROLE_KEY (service role), RLS is bypassed
--    and these policies are not needed for API access. However, they're still
--    useful for direct database queries and client-side access.
-- 2. If your API doesn't have service role key configured, it will use anon key
--    and these RLS policies are REQUIRED for admin access.
-- 3. Check your Vercel/environment variables to ensure SUPABASE_SERVICE_ROLE_KEY
--    is set if you want to bypass RLS for API operations.
-- ============================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Public can read active users" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

-- ============================================================================
-- SELECT POLICIES (Read Access)
-- ============================================================================

-- Policy 1: Admins can read ALL users (required for admin panel)
CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.id = (SELECT auth.uid())::text
    AND u.role = 'admin'
  )
);

-- Policy 2: Users can read their own data
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
USING (
  (SELECT auth.uid())::text = id
);

-- Policy 3: Public can read active users (for seller profiles, dealer pages, etc.)
CREATE POLICY "Public can read active users"
ON users
FOR SELECT
USING (
  status = 'active'
);

-- ============================================================================
-- UPDATE POLICIES (Write Access)
-- ============================================================================

-- Policy 4: Admins can update ALL users (required for admin panel)
CREATE POLICY "Admins can update all users"
ON users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.id = (SELECT auth.uid())::text
    AND u.role = 'admin'
  )
);

-- Policy 5: Users can update their own data
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
USING (
  (SELECT auth.uid())::text = id
);

-- ============================================================================
-- INSERT POLICIES (Create Access)
-- ============================================================================

-- Policy 6: Allow authenticated users to insert (for registration)
-- Note: This is typically handled by your API/auth service
-- Uncomment if you need direct user creation via Supabase client
-- CREATE POLICY "Authenticated users can insert"
-- ON users
-- FOR INSERT
-- WITH CHECK (
--   (SELECT auth.uid()) IS NOT NULL
-- );

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- Verification & Testing
-- ============================================================================

-- Test 1: Check if policies were created successfully
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Test 2: Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users';

-- Test 3: Count total users (should work if service role is used, or if RLS policies allow)
-- Run this as an admin user to verify access
-- SELECT COUNT(*) FROM users;

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. The admin policies check if the current user (auth.uid()) has role='admin'
-- 2. This requires the user to be authenticated via Supabase Auth
-- 3. If using JWT tokens, ensure the token includes the user's role
-- 4. Service role key (SUPABASE_SERVICE_ROLE_KEY) bypasses ALL RLS policies
-- 5. If your API uses service role, these policies are for client-side access only
-- 6. If your API doesn't have service role, these policies are REQUIRED
-- ============================================================================

