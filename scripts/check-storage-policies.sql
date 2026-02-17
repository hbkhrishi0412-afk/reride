-- ============================================================================
-- Check Current Storage RLS Policies
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor to see what policies exist
-- ============================================================================

-- Check all policies for the Images bucket
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

-- Check if RLS is enabled on storage.objects
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- List all storage buckets
SELECT 
  id,
  name,
  public,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY name;

-- Check all policies on storage.objects (all buckets)
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname, cmd;

