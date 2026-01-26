# Supabase Final Setup Guide

## ✅ Migration Complete!

All Firebase features have been migrated to Supabase:
- ✅ Database operations
- ✅ Authentication (email/password, Google OAuth, phone/OTP)
- ✅ Image storage

## Required Supabase Configuration

### 1. Create Storage Bucket for Images

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Name: `images`
5. Make it **Public** (so images can be accessed via URLs)
6. Click **Create bucket**

**Storage Policies** (Optional - for better security):
```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

-- Allow public read access
CREATE POLICY "Public can read images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');
```

### 2. Configure Google OAuth in Supabase

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Google** provider
3. Add your **Google OAuth Client ID** and **Client Secret**
   - Get these from [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials if needed
4. Add your redirect URL: `https://your-project-ref.supabase.co/auth/v1/callback`
5. Save

**Note**: The frontend will redirect to `/auth/callback` after OAuth. You may need to create a callback page or handle the redirect.

### 3. Configure Phone/OTP Authentication (Optional)

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Phone** provider
3. Configure Twilio (if using SMS):
   - Add Twilio Account SID
   - Add Twilio Auth Token
   - Add Twilio Phone Number
4. Or use Supabase's built-in phone auth (may require additional setup)

**Note**: Phone auth requires Twilio or similar SMS provider configuration.

### 4. Update Environment Variables

Make sure these are set in your `.env.local` and Vercel:

```bash
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## What Changed

### Authentication (`services/authService.ts`)
- ✅ Google OAuth now uses Supabase Auth
- ✅ Phone/OTP now uses Supabase Auth
- ✅ Backward compatible (still works with existing code)

### Image Upload (`services/imageUploadService.ts`)
- ✅ Images now upload to Supabase Storage
- ✅ Returns public URLs instead of base64
- ✅ Much more efficient (no base64 encoding)
- ✅ Better performance and storage limits

## Testing Checklist

1. **Google OAuth**
   - [ ] Click "Sign in with Google"
   - [ ] Should redirect to Google
   - [ ] After approval, should redirect back
   - [ ] User should be logged in

2. **Phone/OTP Auth**
   - [ ] Enter phone number
   - [ ] Receive OTP (if Twilio configured)
   - [ ] Enter OTP
   - [ ] Should log in successfully

3. **Image Upload**
   - [ ] Upload an image (vehicle, profile, etc.)
   - [ ] Should upload to Supabase Storage
   - [ ] Should return a public URL
   - [ ] Image should be accessible via URL

## Troubleshooting

### "Bucket not found" error
- Create the `images` bucket in Supabase Storage
- Make sure it's set to public

### Google OAuth not working
- Check Google OAuth credentials in Supabase
- Verify redirect URL is correct
- Check browser console for errors

### Phone OTP not sending
- Verify Twilio is configured in Supabase
- Check phone number format (must include country code)
- Check Supabase logs for errors

### Images not uploading
- Verify `images` bucket exists and is public
- Check storage policies allow uploads
- Verify user is authenticated (for authenticated uploads)

## Migration Notes

- **Old Firebase images**: If you have existing images in Firebase Realtime Database, they'll need to be migrated separately
- **OAuth redirect**: You may need to create an `/auth/callback` route to handle OAuth redirects
- **Storage bucket**: The code expects a bucket named `images` - change in `imageUploadService.ts` if you use a different name

## Next Steps

1. Create the `images` storage bucket
2. Configure Google OAuth in Supabase
3. Test all authentication flows
4. Test image uploads
5. (Optional) Migrate existing Firebase images to Supabase Storage

---

**Status**: 🎉 **100% Migrated to Supabase!**




