# Fix: Storage RLS Policy Error for Image Uploads

## Issue
**Error:** `Failed to upload 1 file(s): Failed to upload image: new row violates row-level security policy`

## Root Cause
The Supabase Storage bucket `Images` has Row-Level Security (RLS) enabled, but there are no policies allowing INSERT operations. This means authenticated users cannot upload images because RLS is blocking the operation.

## Solution
Create RLS policies for the storage bucket that allow:
1. **SELECT** (read) - Public access to view images
2. **INSERT** (upload) - Authenticated users can upload images
3. **UPDATE** (optional) - Users can update their own images
4. **DELETE** (optional) - Users can delete their own images

## How to Fix

### Option 1: Using SQL Script (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file `scripts/fix-storage-rls-policies.sql`
3. Copy and paste the SQL into the SQL Editor
4. Run the script
5. Verify the policies were created

### Option 2: Using Supabase Dashboard

1. Go to **Supabase Dashboard** → **Storage** → **Policies**
2. Select the `Images` bucket
3. Click **"New Policy"** for each operation:

#### Policy 1: Public Read Access (SELECT)
- **Policy name:** `Public can view images`
- **Allowed operation:** `SELECT`
- **Target roles:** `anon`, `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  ```

#### Policy 2: Authenticated Upload (INSERT)
- **Policy name:** `Authenticated users can upload images`
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  ```

#### Policy 3: Authenticated Update (UPDATE) - Optional
- **Policy name:** `Users can update their own images`
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  ```

#### Policy 4: Authenticated Delete (DELETE) - Optional
- **Policy name:** `Users can delete their own images`
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  ```

## Verification

After creating the policies:

1. **Check policies exist:**
   ```sql
   SELECT policyname, cmd, roles
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname LIKE '%image%';
   ```

2. **Test image upload:**
   - Try uploading an image through the admin panel
   - Should no longer get RLS policy errors
   - Image should upload successfully

## Important Notes

1. **Bucket Name:** Make sure the bucket name in the policies matches exactly: `'Images'` (capital I)
2. **RLS Enabled:** RLS must be enabled on the storage bucket for these policies to work
3. **Public vs Private:** The SELECT policy allows public read access. If you want private images, remove the `anon` role from the SELECT policy
4. **Security:** The INSERT policy allows any authenticated user to upload. If you need more restrictions, add additional conditions

## Troubleshooting

### Still getting RLS errors?
1. Check that RLS is enabled on the bucket
2. Verify the bucket name matches exactly (case-sensitive)
3. Make sure you're authenticated when uploading
4. Check the policy conditions match your use case

### Want more restrictive policies?
- Add email-based checks: `(storage.foldername(name))[1] = auth.email()`
- Add role-based checks: `EXISTS (SELECT 1 FROM users WHERE users.email = auth.email() AND users.role = 'admin')`
- Restrict by file type: `(storage.foldername(name))[2] = 'vehicles'`

## Files Created

- `scripts/fix-storage-rls-policies.sql` - SQL script to create all necessary policies
- `STORAGE_RLS_FIX.md` - This documentation file

