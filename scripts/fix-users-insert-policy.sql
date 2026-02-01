-- ============================================================================
-- Fix INSERT Policy for Users Table - Allow User Registration
-- ============================================================================
-- This script creates an INSERT policy that allows user registration.
-- 
-- IMPORTANT NOTES:
-- 1. If your API uses SUPABASE_SERVICE_ROLE_KEY (service role), RLS is bypassed
--    and this policy is not needed for API access. However, it's still useful
--    for direct database queries and client-side access.
-- 2. If your API doesn't have service role key configured, this policy is REQUIRED
--    for user registration to work.
-- 3. Check your Vercel/environment variables to ensure SUPABASE_SERVICE_ROLE_KEY
--    is set if you want to bypass RLS for API operations.
-- ============================================================================

-- Drop existing INSERT policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Allow user registration" ON users;
DROP POLICY IF EXISTS "Service can insert users" ON users;
DROP POLICY IF EXISTS "Public can insert users" ON users;

-- ============================================================================
-- OPTION 1: Allow service role to insert (Recommended for API-based registration)
-- ============================================================================
-- This policy allows inserts when using service role key (bypasses RLS anyway,
-- but good for explicit policy). However, service role bypasses RLS, so this
-- is mainly for documentation/clarity.

-- Note: Service role key bypasses RLS, so this policy won't actually be used
-- when SUPABASE_SERVICE_ROLE_KEY is used. But it's good to have for clarity.

-- ============================================================================
-- OPTION 2: Allow authenticated users to insert (if using Supabase Auth)
-- ============================================================================
-- Uncomment this if you're using Supabase Auth and want authenticated users
-- to be able to create their own user records:
--
-- CREATE POLICY "Allow user registration"
-- ON users
-- FOR INSERT
-- WITH CHECK (
--   (SELECT auth.uid()) IS NOT NULL
-- );

-- ============================================================================
-- OPTION 3: Allow public inserts (NOT RECOMMENDED for production)
-- ============================================================================
-- ⚠️ WARNING: This allows anyone to insert users without authentication.
-- Only use this if you have other security measures in place (e.g., API rate limiting,
-- email verification, etc.). This is generally NOT recommended.
--
-- CREATE POLICY "Public can insert users"
-- ON users
-- FOR INSERT
-- WITH CHECK (true);

-- ============================================================================
-- RECOMMENDED SOLUTION: Disable RLS for INSERT operations
-- ============================================================================
-- If you're using SUPABASE_SERVICE_ROLE_KEY in your API (which bypasses RLS),
-- you don't need an INSERT policy. However, if RLS is enabled and you're NOT
-- using service role key, you MUST have an INSERT policy.

-- Check if RLS is enabled
SELECT 
  'RLS Status' as check_type,
  CASE 
    WHEN rowsecurity THEN 'ENABLED (Policies Required)'
    ELSE 'DISABLED (No Policies Needed)'
  END as status
FROM pg_tables
WHERE tablename = 'users';

-- If RLS is enabled and you're NOT using service role key, uncomment one of the policies above.
-- If RLS is disabled OR you're using service role key, you don't need these policies.

-- ============================================================================
-- Verification
-- ============================================================================

-- Check existing INSERT policies
SELECT 
  'INSERT Policies' as check_type,
  policyname,
  cmd as operation,
  qual as conditions
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'INSERT';

-- ============================================================================
-- Troubleshooting
-- ============================================================================
-- If user registration is failing with "permission denied" or "row-level security" errors:
--
-- 1. Check if SUPABASE_SERVICE_ROLE_KEY is set in your production environment (Vercel)
--    - If YES: Service role bypasses RLS, so policies aren't needed
--    - If NO: You MUST add an INSERT policy (uncomment one of the options above)
--
-- 2. Check if RLS is enabled:
--    SELECT rowsecurity FROM pg_tables WHERE tablename = 'users';
--
-- 3. If RLS is enabled and service role key is missing:
--    - Add an INSERT policy (see options above)
--    - OR set SUPABASE_SERVICE_ROLE_KEY in your environment variables
--
-- 4. Test the policy:
--    - Try inserting a user via your API
--    - Check Vercel logs for error messages
--    - Verify the user appears in Supabase dashboard
-- ============================================================================

