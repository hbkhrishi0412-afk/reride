# Fix: Storage Bucket Name Mismatch

## Issue
**Error:** `Failed to upload 1 file(s): Storage bucket not found. Please create an "images" bucket in Supabase Storage.`

## Root Cause
The code was using `'images'` (lowercase) but the actual bucket in Supabase Storage is named `'Images'` (capitalized). Supabase Storage bucket names are case-sensitive.

## Solution
Updated all references from `'images'` to `'Images'` to match the actual bucket name in Supabase.

## Files Modified

1. **`services/imageUploadService.ts`**
   - Changed `.from('images')` to `.from('Images')` in 3 places:
     - Image upload function
     - Get public URL function
     - Delete image function

2. **`components/EditVehicleModal.tsx`**
   - Changed `.from('images')` to `.from('Images')` for getting public URLs

3. **`components/LazyImage.tsx`**
   - Changed `.from('images')` to `.from('Images')` for getting public URLs

4. **`services/supabase-vehicle-service.ts`**
   - Changed `.from('images')` to `.from('Images')` for processing image URLs

5. **`utils/imageUtils.ts`**
   - Changed `.from('images')` to `.from('Images')` for getting public URLs

6. **`scripts/test-supabase-images.js`**
   - Updated to check for both `'Images'` and `'images'` bucket names
   - Uses the actual bucket name dynamically instead of hardcoded string

## Verification

After these changes:
- Image uploads should work correctly
- Image URLs should be generated properly
- No more "bucket not found" errors

## Important Note

If you need to rename the bucket in Supabase:
1. Go to Supabase Dashboard → Storage
2. The bucket should be named exactly `Images` (capital I)
3. If it's named differently, either:
   - Rename the bucket in Supabase to `Images`, OR
   - Update all code references to match your bucket name

## Testing

To verify the fix:
1. Try uploading an image through the admin panel
2. Check that images display correctly
3. Verify no console errors about bucket not found

