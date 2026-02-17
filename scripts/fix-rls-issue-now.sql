-- ============================================================================
-- IMMEDIATE FIX: Storage RLS Policy for Images Bucket
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This will drop and recreate the INSERT policy to ensure it's correct
-- ============================================================================

-- Step 1: Drop ALL existing INSERT policies for Images bucket (to avoid conflicts)
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND cmd = 'INSERT'
      AND (with_check::text LIKE '%Images%' OR with_check::text LIKE '%images%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Step 2: Create the correct INSERT policy
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- Step 3: Verify the policy was created correctly
SELECT 
  '✅ Policy Created' as status,
  policyname,
  cmd as operation,
  roles,
  with_check as policy_condition
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Authenticated users can upload images';

-- Step 4: Check for any remaining INSERT policies (should only be one now)
SELECT 
  'Policy Count Check' as check_type,
  COUNT(*) as insert_policy_count,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ Perfect - only one INSERT policy'
    WHEN COUNT(*) > 1 THEN '⚠️ WARNING: Multiple INSERT policies found'
    ELSE '❌ No INSERT policies found'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
  AND (with_check::text LIKE '%Images%' OR with_check::text LIKE '%images%');

-- ============================================================================
-- If the above doesn't work, try this alternative (simpler policy for testing)
-- ============================================================================
-- Uncomment the section below ONLY if the above policy still doesn't work
-- This is less secure but can help diagnose if auth.role() is the issue

/*
-- Drop the policy again
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

-- Create simpler version (for testing only)
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'Images');

-- Note: After testing, revert to the authenticated version above
*/

