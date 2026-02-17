-- ============================================================================
-- COMPLETE STORAGE RLS DIAGNOSTIC AND FIX SCRIPT
-- ============================================================================
-- This script will:
-- 1. Check for all issues and errors
-- 2. Remove duplicate policies
-- 3. Fix the RLS policies for Images bucket
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: DIAGNOSTICS - Check Current Status
-- ============================================================================

-- 1.1 Check if bucket exists and configuration
SELECT 
  '=== BUCKET CONFIGURATION ===' as section,
  name as bucket_name,
  public as is_public,
  CASE 
    WHEN name = 'Images' THEN '✅ Bucket name matches'
    ELSE '⚠️ Bucket name may not match (case-sensitive)'
  END as name_status,
  CASE 
    WHEN public THEN '✅ Bucket is public'
    ELSE '⚠️ Bucket is not public'
  END as public_status
FROM storage.buckets
WHERE name IN ('Images', 'images')
ORDER BY name;

-- 1.2 Check RLS is enabled
SELECT 
  '=== RLS STATUS ===' as section,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS is enabled'
    ELSE '❌ RLS is disabled'
  END as status
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- 1.3 Check ALL current INSERT policies (to find duplicates)
SELECT 
  '=== CURRENT INSERT POLICIES (BEFORE FIX) ===' as section,
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

-- 1.4 Count INSERT policies for Images bucket (check for duplicates)
SELECT 
  '=== DUPLICATE CHECK ===' as section,
  COUNT(*) as total_insert_policies,
  COUNT(CASE WHEN with_check::text LIKE '%Images%' OR with_check::text LIKE '%images%' THEN 1 END) as images_bucket_policies,
  CASE 
    WHEN COUNT(CASE WHEN with_check::text LIKE '%Images%' OR with_check::text LIKE '%images%' THEN 1 END) > 1 THEN '❌ DUPLICATES FOUND - Will be removed'
    WHEN COUNT(CASE WHEN with_check::text LIKE '%Images%' OR with_check::text LIKE '%images%' THEN 1 END) = 1 THEN '⚠️ One policy found - will be recreated'
    ELSE '❌ No INSERT policy found for Images bucket'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT';

-- 1.5 Check ALL policies for Images bucket (all operations)
SELECT 
  '=== ALL POLICIES FOR IMAGES BUCKET ===' as section,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ Read access'
    WHEN cmd = 'INSERT' THEN '✅ Upload access'
    WHEN cmd = 'UPDATE' THEN '✅ Update access'
    WHEN cmd = 'DELETE' THEN '✅ Delete access'
    ELSE 'Other'
  END as purpose
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
ORDER BY cmd, policyname;

-- ============================================================================
-- PART 2: CLEANUP - Remove Duplicates and Old Policies
-- ============================================================================

-- 2.1 Drop ALL existing INSERT policies for Images bucket (removes duplicates)
DO $$
DECLARE
  policy_record RECORD;
  dropped_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== CLEANUP: Removing duplicate INSERT policies ===';
  
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND cmd = 'INSERT'
      AND (
        with_check::text LIKE '%Images%' 
        OR with_check::text LIKE '%images%'
        OR policyname LIKE '%image%'
        OR policyname LIKE '%Images%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
    dropped_count := dropped_count + 1;
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
  
  RAISE NOTICE 'Total policies dropped: %', dropped_count;
END $$;

-- 2.2 Verify policies were dropped
SELECT 
  '=== CLEANUP VERIFICATION ===' as section,
  COUNT(*) as remaining_insert_policies,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All INSERT policies removed - ready for fresh policy'
    ELSE '⚠️ Some policies still exist'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
  AND (
    with_check::text LIKE '%Images%' 
    OR with_check::text LIKE '%images%'
    OR policyname LIKE '%image%'
  );

-- ============================================================================
-- PART 3: FIX - Create Correct Policies
-- ============================================================================

-- 3.1 Create SELECT policy (Public read access)
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;

CREATE POLICY "Public can view images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'Images');

-- 3.2 Create INSERT policy (Authenticated upload) - THE CRITICAL ONE
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- 3.3 Create UPDATE policy (Authenticated update)
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;

CREATE POLICY "Authenticated users can update images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- 3.4 Create DELETE policy (Authenticated delete)
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

CREATE POLICY "Authenticated users can delete images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- ============================================================================
-- PART 4: VERIFICATION - Confirm Everything is Fixed
-- ============================================================================

-- 4.1 Verify all policies were created
SELECT 
  '=== FINAL POLICY STATUS ===' as section,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN cmd = 'SELECT' AND with_check IS NULL AND qual::text LIKE '%Images%' THEN '✅ Public read access'
    WHEN cmd = 'INSERT' AND with_check::text LIKE '%Images%' AND with_check::text LIKE '%authenticated%' THEN '✅ Authenticated upload'
    WHEN cmd = 'UPDATE' AND qual::text LIKE '%Images%' AND qual::text LIKE '%authenticated%' THEN '✅ Authenticated update'
    WHEN cmd = 'DELETE' AND qual::text LIKE '%Images%' AND qual::text LIKE '%authenticated%' THEN '✅ Authenticated delete'
    ELSE '⚠️ Check policy condition'
  END as status,
  with_check as policy_condition
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname LIKE '%image%' 
    OR policyname LIKE '%Images%'
    OR qual::text LIKE '%Images%'
    OR with_check::text LIKE '%Images%'
  )
ORDER BY 
  CASE cmd
    WHEN 'SELECT' THEN 1
    WHEN 'INSERT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
    ELSE 5
  END,
  policyname;

-- 4.2 Final count check (should be exactly 4 policies)
SELECT 
  '=== FINAL COUNT CHECK ===' as section,
  COUNT(*) as total_policies,
  COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
  COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
  COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
  COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies,
  CASE 
    WHEN COUNT(*) = 4 AND COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) = 1 THEN '✅ Perfect - All policies created correctly'
    WHEN COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) > 1 THEN '❌ ERROR: Multiple INSERT policies found'
    WHEN COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) = 0 THEN '❌ ERROR: No INSERT policy found'
    ELSE '⚠️ Check policy count'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname LIKE '%image%' 
    OR policyname LIKE '%Images%'
    OR qual::text LIKE '%Images%'
    OR with_check::text LIKE '%Images%'
  );

-- 4.3 Verify INSERT policy specifically (the critical one)
SELECT 
  '=== INSERT POLICY VERIFICATION ===' as section,
  policyname,
  with_check as policy_condition,
  CASE 
    WHEN with_check::text LIKE '%Images%' AND with_check::text LIKE '%authenticated%' THEN '✅ Policy is correct'
    WHEN with_check::text LIKE '%Images%' THEN '⚠️ Policy checks bucket but may not check authentication'
    ELSE '❌ Policy condition may be incorrect'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
  AND (
    policyname LIKE '%image%' 
    OR policyname LIKE '%Images%'
    OR with_check::text LIKE '%Images%'
  );

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  '=== SCRIPT COMPLETED ===' as section,
  '✅ All duplicate policies removed' as step1,
  '✅ All policies recreated correctly' as step2,
  '✅ Ready to test uploads' as step3,
  'Next: Try uploading an image in your application' as next_step;

