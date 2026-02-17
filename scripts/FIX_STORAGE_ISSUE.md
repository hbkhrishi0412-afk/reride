# Fix Storage RLS Policy Error - Complete Guide

## Issue Identified

The diagnostic script found that **the "Images" bucket does not exist** in your Supabase Storage.

However, if you're still seeing the RLS policy error, it could mean:
1. The bucket exists but RLS policies are missing
2. The bucket name doesn't match (case-sensitive: must be "Images" with capital I)
3. Connection/permission issues

## Step-by-Step Fix

### Step 1: Verify Supabase Connection

Run this to check your connection:
```bash
node scripts/test-supabase-images.js
```

### Step 2: Create the Storage Bucket (if missing)

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"** or **"Create bucket"**
5. Configure the bucket:
   - **Name**: `Images` (must be exactly "Images" with capital I - case-sensitive!)
   - **Public bucket**: ✅ **Enable this** (toggle it ON)
   - **File size limit**: 10 MB (or your preference)
   - **Allowed MIME types**: `image/*` (or leave empty for all types)
6. Click **"Create bucket"**

### Step 3: Check Existing Policies

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `scripts/check-storage-policies.sql`
3. Run the query
4. Review the results to see what policies exist

### Step 4: Create RLS Policies

You have two options:

#### Option A: Using SQL Script (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file `scripts/fix-storage-rls-policies.sql`
3. Copy and paste the SQL into the SQL Editor
4. **Important**: Make sure the bucket name in the script matches your bucket name exactly
   - The script uses `'Images'` (capital I)
   - If your bucket is named differently, replace all instances of `'Images'` with your bucket name
5. Run the script
6. You should see success messages for each policy created

#### Option B: Using Supabase Dashboard

1. Go to **Supabase Dashboard** → **Storage** → **Policies**
2. Select the `Images` bucket
3. Click **"New Policy"** for each operation:

##### Policy 1: Public Read Access (SELECT)
- **Policy name:** `Public can view images`
- **Allowed operation:** `SELECT`
- **Target roles:** `anon`, `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  ```

##### Policy 2: Authenticated Upload (INSERT) - **THIS IS THE CRITICAL ONE**
- **Policy name:** `Authenticated users can upload images`
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  ```

##### Policy 3: Authenticated Update (UPDATE) - Optional
- **Policy name:** `Users can update their own images`
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  ```

##### Policy 4: Authenticated Delete (DELETE) - Optional
- **Policy name:** `Users can delete their own images`
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`
- **Policy definition:**
  ```sql
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
  ```

### Step 5: Verify the Fix

1. Run the diagnostic script again:
   ```bash
   node scripts/diagnose-storage-rls.js
   ```

2. The script will:
   - Check if the bucket exists
   - Test SELECT permission (listing files)
   - Test INSERT permission (uploading a test file)
   - Report any issues

3. If the test upload succeeds, your issue is fixed! ✅

### Step 6: Test in Your Application

1. Try uploading an image through your application
2. The upload should now succeed without the RLS policy error

## Common Issues

### Issue: "Bucket not found"
- **Solution**: Create the bucket as described in Step 2
- Make sure the bucket name matches exactly: `Images` (capital I)

### Issue: "row-level security policy" error
- **Solution**: The INSERT policy is missing. Follow Step 4 to create it.

### Issue: "Permission denied"
- **Solution**: Check that:
  1. The bucket is public (for SELECT operations)
  2. You're authenticated (for INSERT operations)
  3. The policies are correctly configured

### Issue: Bucket name mismatch
- **Solution**: Supabase bucket names are case-sensitive
- The code uses `'Images'` (capital I)
- Make sure your bucket name matches exactly, or update the code in `services/imageUploadService.ts` line 127

## Quick SQL Fix (Copy-Paste Ready)

If you just want to quickly fix it, run this in Supabase SQL Editor:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Create SELECT policy (public read)
CREATE POLICY "Public can view images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'Images');

-- Create INSERT policy (authenticated upload) - CRITICAL!
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

-- Create UPDATE policy (optional)
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

-- Create DELETE policy (optional)
CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);
```

**Note**: Replace `'Images'` with your actual bucket name if different.

## Still Having Issues?

1. Check the Supabase Dashboard → Storage → Policies to see what policies exist
2. Run `scripts/check-storage-policies.sql` in SQL Editor to see current policies
3. Check the browser console for detailed error messages
4. Verify your Supabase credentials in `.env.local`

