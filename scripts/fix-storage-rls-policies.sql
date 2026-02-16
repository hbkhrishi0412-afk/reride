-- ============================================================================
-- Fix Supabase Storage RLS Policies for Images Bucket
-- ============================================================================
-- This script creates RLS policies to allow:
-- 1. Public read access (SELECT) - anyone can view images
-- 2. Authenticated upload (INSERT) - logged-in users can upload images
-- 3. Authenticated update (UPDATE) - users can update their own images
-- 4. Authenticated delete (DELETE) - users can delete their own images
-- ============================================================================

-- First, ensure RLS is enabled on the storage.objects table
-- (This is usually enabled by default, but we'll check)

-- ============================================================================
-- Policy 1: Public Read Access (SELECT)
-- ============================================================================
-- Allows anyone (including anonymous users) to read/view images
-- This is needed for images to display on the website

DROP POLICY IF EXISTS "Public can view images" ON storage.objects;

CREATE POLICY "Public can view images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'Images'
);

-- ============================================================================
-- Policy 2: Authenticated Upload (INSERT)
-- ============================================================================
-- Allows authenticated users to upload images
-- This fixes the "new row violates row-level security policy" error

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- ============================================================================
-- Policy 3: Authenticated Update (UPDATE)
-- ============================================================================
-- Allows authenticated users to update image metadata
-- Users can only update files they uploaded (based on owner)

DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;

CREATE POLICY "Users can update their own images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.email()
)
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.email()
);

-- ============================================================================
-- Policy 4: Authenticated Delete (DELETE)
-- ============================================================================
-- Allows authenticated users to delete images
-- Users can only delete files they uploaded (based on owner)
-- Admins can delete any file

DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'Images'
  AND (
    -- User can delete their own files (check folder structure)
    (auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.email())
    OR
    -- Admin can delete any file (check if user is admin)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = auth.email()
      AND users.role = 'admin'
    )
  )
);

-- ============================================================================
-- Alternative: Simpler policies if folder-based ownership doesn't work
-- ============================================================================
-- If the above policies don't work, uncomment these simpler policies:

-- DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
-- CREATE POLICY "Authenticated users can upload images"
-- ON storage.objects
-- FOR INSERT
-- WITH CHECK (
--   bucket_id = 'Images'
--   AND auth.role() = 'authenticated'
-- );

-- DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
-- CREATE POLICY "Authenticated users can update images"
-- ON storage.objects
-- FOR UPDATE
-- USING (
--   bucket_id = 'Images'
--   AND auth.role() = 'authenticated'
-- )
-- WITH CHECK (
--   bucket_id = 'Images'
--   AND auth.role() = 'authenticated'
-- );

-- DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
-- CREATE POLICY "Authenticated users can delete images"
-- ON storage.objects
-- FOR DELETE
-- USING (
--   bucket_id = 'Images'
--   AND auth.role() = 'authenticated'
-- );

-- ============================================================================
-- Verification Queries
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
  AND policyname LIKE '%image%'
ORDER BY policyname, cmd;

-- Check if RLS is enabled on storage.objects
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- ============================================================================
-- Notes
-- ============================================================================
-- 1. Make sure the bucket name matches exactly: 'Images' (capital I)
-- 2. If you're using a different bucket name, replace 'Images' with your bucket name
-- 3. The policies above allow:
--    - Anyone to read/view images (public access)
--    - Authenticated users to upload images
--    - Authenticated users to update/delete their own images
--    - Admins to delete any images
-- 4. If you need more restrictive policies, adjust the conditions accordingly

