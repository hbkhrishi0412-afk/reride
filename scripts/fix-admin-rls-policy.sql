-- ============================================================================
-- Fix "Admins can read all users" RLS Policy
-- ============================================================================
-- The current policy is broken because it checks auth.uid() (UUID) against 
-- users.id (email-based key), which will never match.
--
-- IMPORTANT: The BEST solution is to use SUPABASE_SERVICE_ROLE_KEY in production,
-- which bypasses RLS entirely. However, if you need RLS policies as a fallback,
-- this script fixes the admin policy.
-- ============================================================================

-- Drop the broken policy
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

-- ============================================================================
-- OPTION 1: Check by email (Recommended if using email-based auth)
-- ============================================================================
-- This checks if the authenticated user's email matches an admin user's email
-- Note: This requires auth.email() to be available in your Supabase setup

CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.email = (SELECT auth.email())
    AND u.role = 'admin'
  )
);

CREATE POLICY "Admins can update all users"
ON users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.email = (SELECT auth.email())
    AND u.role = 'admin'
  )
);

-- ============================================================================
-- OPTION 2: Use JWT claims (if role is in JWT token)
-- ============================================================================
-- If your JWT token includes a 'role' claim, you can use this instead:
-- Uncomment and use this if Option 1 doesn't work:

-- DROP POLICY IF EXISTS "Admins can read all users" ON users;
-- DROP POLICY IF EXISTS "Admins can update all users" ON users;
--
-- CREATE POLICY "Admins can read all users"
-- ON users
-- FOR SELECT
-- USING (
--   (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
-- );
--
-- CREATE POLICY "Admins can update all users"
-- ON users
-- FOR UPDATE
-- USING (
--   (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
-- );

-- ============================================================================
-- OPTION 3: Allow service role (if using service role key)
-- ============================================================================
-- Note: Service role key bypasses RLS anyway, so this is mainly for documentation
-- Uncomment if you want explicit policy for service role:

-- CREATE POLICY "Service role can read all users"
-- ON users
-- FOR SELECT
-- USING (
--   current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
-- );

-- ============================================================================
-- Verification
-- ============================================================================

-- Check if policies were created
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as conditions
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname LIKE '%Admin%'
ORDER BY policyname;

-- Test: Count users (should work if policy is correct and user is admin)
-- This will only work if you're authenticated as an admin
SELECT COUNT(*) as total_users FROM users;


