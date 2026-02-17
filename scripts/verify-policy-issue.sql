-- ============================================================================
-- Verify Storage RLS Policy Issue
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor to diagnose policy issues
-- ============================================================================

-- 1. Check all policies for Images bucket
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname LIKE '%image%' 
    OR policyname LIKE '%Images%'
    OR qual::text LIKE '%Images%'
    OR qual::text LIKE '%images%'
    OR with_check::text LIKE '%Images%'
    OR with_check::text LIKE '%images%'
  )
ORDER BY policyname, cmd;

-- 2. Check if there are conflicting policies (multiple INSERT policies)
SELECT 
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- 3. Test auth.role() function (should return 'authenticated' for logged-in users)
SELECT auth.role() as current_role;

-- 4. Check if bucket exists and is public
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE name IN ('Images', 'images')
ORDER BY name;

-- 5. Check RLS is enabled on storage.objects
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- 6. If INSERT policy exists but isn't working, try this diagnostic:
-- Check if the policy condition is being evaluated correctly
-- (This will show the exact policy definition)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
  AND policyname LIKE '%image%';

