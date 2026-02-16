# Images Not Loading - Diagnosis & Fix

## Problem Identified

The images are not loading from Supabase because:

1. **The `images` bucket doesn't exist in Supabase Storage**
   - The test script confirmed: "images" bucket not found
   - You mentioned adding an "images folder" - but Supabase requires a **bucket**, not just a folder

## What I Fixed

### 1. Enhanced Error Logging
- Added detailed logging in `processImageUrls()` function to help debug image URL conversion
- Improved error messages in `LazyImage` component to show what's happening when images fail to load
- Added console logs to track image path conversion

### 2. Improved Image Path Handling
- Enhanced the `processImageUrls()` function to better handle different path formats
- Added fallback logic in `LazyImage` component to try multiple path formats
- Better error messages when image conversion fails

### 3. Created Diagnostic Tools
- `scripts/test-supabase-images.js` - Test script to verify bucket setup
- `scripts/setup-supabase-storage.md` - Step-by-step setup guide

## What You Need to Do

### Step 1: Create the Storage Bucket

1. Go to **Supabase Dashboard** → Your Project → **Storage**
2. Click **"New bucket"** or **"Create bucket"**
3. Configure:
   - **Name**: `images` (exactly this name, lowercase)
   - **Public bucket**: ✅ **Enable** (this is critical!)
   - **File size limit**: 10 MB
4. Click **"Create bucket"**

### Step 2: Set Up Storage Policy

1. Go to **Storage** → **Policies** (or click the `images` bucket → **Policies** tab)
2. Click **"New Policy"**
3. Configure:
   - **Policy name**: `Public Access`
   - **Allowed operation**: `SELECT`
   - **Target roles**: `anon`, `authenticated`
   - **Policy**: `bucket_id = 'images'`
4. Click **"Save policy"**

### Step 3: Verify Setup

Run the test script:
```bash
node scripts/test-supabase-images.js
```

You should see:
- ✅ "images" bucket found
- ✅ Public: Yes
- ✅ Files listed (if any)

### Step 4: Test in Your App

1. Open your app in the browser
2. Open browser DevTools (F12) → Console tab
3. Try to view a vehicle listing
4. Check the console for:
   - Image URL conversion logs
   - Any error messages
   - Network tab to see if image requests are being made

## How Images Work Now

1. **When uploading**: Images are uploaded to `images/vehicles/{filename}` and the public URL is stored in the database
2. **When displaying**: 
   - If the image is already a full URL → use it directly
   - If it's a storage path → convert it to a public URL using `getPublicUrl()`
   - If conversion fails → show "Image not available" placeholder

## Debugging Tips

### Check Browser Console
Look for these log messages:
- `✅ Image URL converted:` - Successfully converted storage path to URL
- `⚠️ No public URL generated` - Conversion failed, check bucket setup
- `❌ Error getting public URL` - Storage bucket issue

### Check Network Tab
1. Open DevTools → Network tab
2. Filter by "Img"
3. Look for failed requests (red status codes)
4. Check if URLs are being generated correctly

### Common Issues

**Issue**: Images show "Image not available"
- **Cause**: Bucket doesn't exist or isn't public
- **Fix**: Follow Step 1 and 2 above

**Issue**: 403 Forbidden errors
- **Cause**: Bucket is not public or policy is missing
- **Fix**: Make bucket public and add SELECT policy

**Issue**: Images upload but don't display
- **Cause**: Images stored as paths instead of URLs
- **Fix**: The `processImageUrls()` function should handle this automatically

## Files Modified

1. `services/supabase-vehicle-service.ts` - Enhanced `processImageUrls()` with better logging
2. `components/LazyImage.tsx` - Improved error handling and path conversion
3. `scripts/test-supabase-images.js` - New diagnostic script
4. `scripts/setup-supabase-storage.md` - Setup guide

## Next Steps

1. ✅ Create the `images` bucket in Supabase (Step 1)
2. ✅ Set up the storage policy (Step 2)
3. ✅ Run the test script to verify (Step 3)
4. ✅ Test image upload and display in your app (Step 4)
5. ✅ Check browser console for any remaining issues

After completing these steps, images should load correctly!

