-- ============================================================================
-- Diagnose and Fix Storage RLS Policy Issues
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This will check for issues and provide fixes
-- ============================================================================

-- Step 1: Check current INSERT policies
SELECT 
  'Current INSERT Policies' as check_type,
  policyname,
  cmd as operation,
  roles,
  permissive,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Step 2: Check if there are multiple INSERT policies (potential conflict)
SELECT 
  'Multiple INSERT Policies Check' as check_type,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 1 THEN '⚠️ WARNING: Multiple INSERT policies found - may cause conflicts!'
    WHEN COUNT(*) = 1 THEN '✅ Only one INSERT policy found'
    ELSE '❌ No INSERT policies found'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT';

-- Step 3: Check the exact policy definition for Images bucket
SELECT 
  'Images Bucket INSERT Policy Details' as check_type,
  policyname,
  with_check as policy_condition,
  CASE 
    WHEN with_check::text LIKE '%Images%' AND with_check::text LIKE '%authenticated%' THEN '✅ Policy looks correct'
    WHEN with_check::text LIKE '%Images%' THEN '⚠️ Policy checks bucket but may not check authentication'
    ELSE '❌ Policy condition may be incorrect'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
  AND (with_check::text LIKE '%Images%' OR with_check::text LIKE '%images%');

-- Step 4: Check if RLS is enabled
SELECT 
  'RLS Status' as check_type,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS is enabled'
    ELSE '❌ RLS is disabled (this is unusual)'
  END as status
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- Step 5: Check bucket exists and is configured correctly
SELECT 
  'Bucket Configuration' as check_type,
  name,
  public,
  CASE 
    WHEN name = 'Images' THEN '✅ Bucket name matches'
    ELSE '⚠️ Bucket name may not match (case-sensitive)'
  END as name_status,
  CASE 
    WHEN public THEN '✅ Bucket is public'
    ELSE '⚠️ Bucket is not public (may affect SELECT policy)'
  END as public_status
FROM storage.buckets
WHERE name IN ('Images', 'images')
ORDER BY name;

-- ============================================================================
-- FIX: Drop and recreate the INSERT policy (if needed)
-- ============================================================================
-- Uncomment the section below if you want to reset the INSERT policy
-- This will ensure it's correctly configured

/*
-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

-- Recreate with correct configuration
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- Verify it was created
SELECT 
  'Policy Recreated' as status,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Authenticated users can upload images';
*/

-- ============================================================================
-- ALTERNATIVE: If the above doesn't work, try a simpler policy (for testing)
-- ============================================================================
-- This is less secure but can help diagnose if the issue is with auth.role()
-- Only use for testing, then revert to the authenticated version above

/*
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'Images');
*/

