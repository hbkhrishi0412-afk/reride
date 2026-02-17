# Troubleshooting Storage RLS Policy Error

## Current Status

Based on your Supabase policies table, you have all 4 required policies:
1. ✅ **SELECT** - "Public can view images"
2. ✅ **INSERT** - "Authenticated users can upload images" 
3. ✅ **UPDATE** - "Authenticated users can update images"
4. ✅ **DELETE** - "Authenticated users can delete images" (admin only)

## The Problem

Even though the INSERT policy exists, you're still getting the RLS error. This suggests one of these issues:

### Possible Causes

1. **Authentication Issue**
   - The user might not be properly authenticated when uploading
   - `auth.role()` might not be returning `'authenticated'`
   - Session might have expired

2. **Policy Conflict**
   - There might be another policy conflicting with the INSERT policy
   - Multiple INSERT policies might be conflicting

3. **Policy Not Active**
   - The policy might exist but not be enabled
   - There might be a syntax error in the policy definition

4. **Bucket Name Mismatch**
   - The policy checks `bucket_id = 'Images'` but the actual bucket might be different
   - Case sensitivity issue

## Diagnostic Steps

### Step 1: Verify Authentication

Run this test script:
```bash
node scripts/test-storage-upload-auth.js
```

This will:
- Check if you're authenticated
- Test SELECT permission
- Test INSERT permission
- Show detailed error messages

### Step 2: Check Policies in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run `scripts/verify-policy-issue.sql`
3. Review the results to see:
   - All policies for Images bucket
   - If there are conflicting INSERT policies
   - Current auth.role() value
   - Bucket configuration

### Step 3: Check Browser Console

When you try to upload an image:
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for detailed error messages
4. Go to **Network** tab
5. Find the failed upload request
6. Check the response for the exact error

### Step 4: Verify Policy Details

In Supabase Dashboard:
1. Go to **Storage** → **Policies**
2. Click on the `Images` bucket
3. Find the "Authenticated users can upload images" policy
4. Verify:
   - **Operation**: INSERT
   - **Policy definition**: `bucket_id = 'Images' AND auth.role() = 'authenticated'`
   - **Status**: Enabled/Active

## Solutions to Try

### Solution 1: Recreate the INSERT Policy

Sometimes policies can get into a bad state. Try recreating it:

```sql
-- Drop the existing policy
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

-- Recreate it
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);
```

### Solution 2: Simplify the Policy (Temporary Test)

Try a simpler policy to test if the issue is with the condition:

```sql
-- Drop existing
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;

-- Create simpler version (less restrictive for testing)
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'Images');
```

**Note**: This is less secure - only use for testing! Revert to the authenticated version after testing.

### Solution 3: Check for Conflicting Policies

Run this to see if there are multiple INSERT policies:

```sql
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'INSERT'
ORDER BY policyname;
```

If you see multiple INSERT policies, you might need to drop the conflicting ones.

### Solution 4: Verify User Authentication

Check if the user is actually authenticated:

```sql
-- This should return 'authenticated' for logged-in users
SELECT auth.role() as current_role;

-- Check current user
SELECT auth.uid() as current_user_id;
```

### Solution 5: Test with Service Role (Bypass RLS)

If you have the service role key, you can test if the issue is specifically with RLS:

```bash
# This will use service role which bypasses RLS
# Only use for testing!
SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/test-storage-upload-auth.js
```

If uploads work with service role but not with anon key, the issue is definitely with RLS policies.

## Quick Fix Script

If you want to quickly reset all policies:

```sql
-- Drop all existing policies
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

-- Recreate all policies
CREATE POLICY "Public can view images"
ON storage.objects FOR SELECT
USING (bucket_id = 'Images');

CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'Images'
  AND auth.role() = 'authenticated'
);
```

## Still Not Working?

If none of the above works:

1. **Check the exact error message** in browser console
2. **Verify bucket name** matches exactly (case-sensitive: `Images`)
3. **Check Supabase logs** in Dashboard → Logs → API
4. **Try uploading from a different browser/incognito** to rule out cache issues
5. **Verify your Supabase credentials** are correct in `.env.local`

## Common Error Messages

- `"new row violates row-level security policy"` → INSERT policy issue
- `"permission denied"` → Policy exists but condition not met
- `"Bucket not found"` → Bucket doesn't exist or wrong name
- `"JWT expired"` → Authentication session expired, need to re-login

