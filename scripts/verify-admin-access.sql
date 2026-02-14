-- ============================================================================
-- Verify Admin Access to Users Table
-- ============================================================================
-- Run this script to diagnose why admin panel might not be showing users
-- ============================================================================

-- 1. Check if RLS is enabled
SELECT 
  'RLS Status' as check_type,
  CASE 
    WHEN rowsecurity THEN 'ENABLED (Policies Required)'
    ELSE 'DISABLED (No Policies Needed)'
  END as status
FROM pg_tables
WHERE tablename = 'users';

-- 2. List all RLS policies on users table
SELECT 
  'RLS Policies' as check_type,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has conditions'
    ELSE 'No conditions'
  END as has_conditions
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 3. Count total users in database
SELECT 
  'User Count' as check_type,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
  COUNT(*) FILTER (WHERE role = 'seller') as seller_count,
  COUNT(*) FILTER (WHERE role = 'customer') as customer_count
FROM users;

-- 4. Check for users with missing required fields (these will be filtered out)
SELECT 
  'Data Quality Check' as check_type,
  COUNT(*) FILTER (WHERE id IS NULL OR id = '') as missing_id,
  COUNT(*) FILTER (WHERE email IS NULL OR email = '') as missing_email,
  COUNT(*) FILTER (WHERE role IS NULL OR role NOT IN ('customer', 'seller', 'admin')) as invalid_role
FROM users;

-- 5. Sample users (first 5) to verify data structure
SELECT 
  'Sample Users' as check_type,
  id,
  email,
  name,
  role,
  status,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- 1. If RLS is ENABLED: You should see policies listed
--    - If no policies: That's the problem! Run fix-users-rls-policies.sql
--    - If policies exist: Check if admin policy is present
--
-- 2. User Count: Should show > 0 if users exist
--    - If 0: No users in database (seed data needed)
--    - If > 0: Users exist, check RLS policies
--
-- 3. Data Quality: Should show 0 for all counts
--    - If > 0: Some users have invalid data and will be filtered out
--
-- 4. Sample Users: Should show valid user records
--    - Check that id, email, role fields are populated
-- ============================================================================









