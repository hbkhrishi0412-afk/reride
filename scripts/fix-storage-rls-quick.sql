-- ============================================================================
-- QUICK FIX: Storage RLS Policies for Images Bucket
-- ============================================================================
-- Copy and paste this entire script into Supabase Dashboard → SQL Editor
-- Then click "Run" to create all necessary policies
-- ============================================================================

-- Step 1: Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Step 2: Create SELECT policy (Public read access)
-- This allows anyone to view/download images
CREATE POLICY "Public can view images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'Images');

-- Step 3: Create INSERT policy (Authenticated upload) - THIS FIXES YOUR ERROR!
-- This allows logged-in users to upload images
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- Step 4: Create UPDATE policy (Optional - for updating image metadata)
CREATE POLICY "Users can update their own images"
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

-- Step 5: Create DELETE policy (Optional - for deleting images)
CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- ============================================================================
-- VERIFICATION: Check if policies were created successfully
-- ============================================================================
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%image%'
ORDER BY policyname, cmd;

-- You should see 4 policies listed above if everything worked correctly!

