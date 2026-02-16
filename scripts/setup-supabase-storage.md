# Supabase Storage Setup Guide

## Issue: Images Not Loading

The images are not loading because the Supabase Storage bucket needs to be properly configured.

## Step-by-Step Setup

### 1. Create the Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"** or **"Create bucket"**
5. Configure the bucket:
   - **Name**: `images` (must be exactly "images")
   - **Public bucket**: ✅ **Enable this** (toggle it ON)
   - **File size limit**: 10 MB (or your preference)
   - **Allowed MIME types**: `image/*` (or leave empty for all types)

6. Click **"Create bucket"**

### 2. Set Up Storage Policies (for Public Access)

After creating the bucket:

1. Go to **Storage** → **Policies** (or click on the `images` bucket → **Policies** tab)
2. Click **"New Policy"**
3. Create a policy for **SELECT** (read access):
   - **Policy name**: `Public Access`
   - **Allowed operation**: `SELECT`
   - **Target roles**: `anon`, `authenticated`
   - **Policy definition**:
   ```sql
   bucket_id = 'images'
   ```
   OR use the visual editor:
   - **Policy**: `bucket_id` equals `images`

4. Click **"Save policy"**

### 3. Verify the Setup

Run the test script to verify:

```bash
node scripts/test-supabase-images.js
```

You should see:
- ✅ "images" bucket found
- ✅ Public: Yes
- ✅ Files listed (if any exist)

### 4. Test Image Upload

After setting up the bucket, try uploading an image through your app. The image should:
1. Upload successfully to `images/vehicles/{filename}`
2. Generate a public URL
3. Display correctly in the vehicle listing

## Common Issues

### Issue: "Bucket not found"
- **Solution**: Make sure the bucket name is exactly `images` (lowercase, no spaces)

### Issue: "Permission denied"
- **Solution**: 
  1. Make sure the bucket is set to **Public**
  2. Check that you have a storage policy allowing SELECT operations

### Issue: Images upload but don't display
- **Solution**: 
  1. Check that the bucket is **Public**
  2. Verify the storage policy allows public read access
  3. Check browser console for CORS errors

### Issue: "403 Forbidden" when accessing image URLs
- **Solution**: The bucket is not public or the policy is incorrect. Re-check steps 1 and 2 above.

## Storage Structure

Your images will be stored like this:
```
images/
  ├── vehicles/
  │   ├── 1234567890_abc123.jpg
  │   ├── 1234567891_def456.jpg
  │   └── vehicles/
  │       └── 1234567892/
  │           └── ghi789.jpg
  └── users/
      └── user@example.com/
          └── profile.jpg
```

## Next Steps

After setting up the bucket:
1. Run the test script: `node scripts/test-supabase-images.js`
2. Try uploading a test image through your app
3. Check the browser console for any errors
4. Verify images display correctly in vehicle listings

