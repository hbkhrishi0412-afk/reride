-- ============================================================================
-- Check SELECT Policy for Users Table - Diagnose Why Users Show as Zero
-- ============================================================================
-- This script checks if RLS is enabled and if SELECT policies exist that
-- might be blocking access to users, even when using service role key.
-- ============================================================================

-- Check if RLS is enabled on users table
SELECT 
  'RLS Status' as check_type,
  CASE 
    WHEN rowsecurity THEN 'ENABLED (Policies May Block Access)'
    ELSE 'DISABLED (No Policies Needed)'
  END as status,
  CASE 
    WHEN rowsecurity THEN '⚠️ If service role key is set, RLS should be bypassed. If users still show as 0, check service role key configuration.'
    ELSE '✅ RLS is disabled, so policies won''t block access.'
  END as note
FROM pg_tables
WHERE tablename = 'users';

-- Check existing SELECT policies
SELECT 
  'SELECT Policies' as check_type,
  policyname,
  cmd as operation,
  roles as allowed_roles,
  qual as conditions,
  with_check as with_check_conditions
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT';

-- Count total users in database (bypasses RLS if run with service role)
SELECT 
  'User Count' as check_type,
  COUNT(*) as total_users,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
  COUNT(CASE WHEN role = 'seller' THEN 1 END) as seller_users,
  COUNT(CASE WHEN role = 'customer' THEN 1 END) as customer_users
FROM users;

-- Check if service role is being used (this query should work if service role is active)
SELECT 
  'Service Role Check' as check_type,
  CASE 
    WHEN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' 
    THEN '✅ Service role is active (RLS bypassed)'
    ELSE '⚠️ Service role may not be active (check SUPABASE_SERVICE_ROLE_KEY)'
  END as status;

-- ============================================================================
-- Troubleshooting Guide
-- ============================================================================
-- If users show as 0 in admin panel:
--
-- 1. Check SUPABASE_SERVICE_ROLE_KEY in Vercel:
--    - Go to Vercel Dashboard → Project → Settings → Environment Variables
--    - Verify SUPABASE_SERVICE_ROLE_KEY is set for Production
--    - The key should be long (100+ characters)
--    - Get it from Supabase Dashboard → Settings → API → service_role key
--
-- 2. If service role key is set but still getting 0 users:
--    - Check Vercel function logs for errors
--    - Look for "SUPABASE_SERVICE_ROLE_KEY" errors
--    - Look for "permission denied" or "row-level security" errors
--
-- 3. If RLS is enabled and you're NOT using service role key:
--    - You need a SELECT policy that allows admin access
--    - Example: CREATE POLICY "Admins can select all users" ON users FOR SELECT USING (true);
--    - But RECOMMENDED: Use service role key instead (bypasses RLS)
--
-- 4. Verify users exist:
--    - Run the "User Count" query above
--    - If count > 0 but admin panel shows 0, it's an access issue
--    - If count = 0, users need to be created first
--
-- 5. Test the API endpoint:
--    - Make a GET request to /api/users with admin auth token
--    - Check the response and Vercel logs
--    - Look for errors in the response
-- ============================================================================



