# Firebase Profile Sync Fix

## Problem
When users updated their profile (name, email, avatar, mobile), the changes were saved to Firebase Realtime Database but **not** synced to Firebase Auth. This caused a disconnect between:
- Firebase Realtime Database (user data storage)
- Firebase Auth (authentication profile with displayName, photoURL, etc.)

## Solution Implemented

### 1. Created Firebase Admin SDK Integration (`lib/firebase-admin.ts`)
- Initialized Firebase Admin SDK for server-side operations
- Supports multiple initialization methods:
  - Service Account Key (via `FIREBASE_SERVICE_ACCOUNT_KEY` env var)
  - Application Default Credentials (for Vercel with linked Firebase project)
  - Graceful fallback if credentials aren't available
- Created `updateFirebaseAuthProfile()` function to sync Auth profile updates

### 2. Updated User Update Endpoint (`api/main.ts`)
- Added Firebase Auth profile sync after database updates
- Maps database fields to Firebase Auth fields:
  - `name` → `displayName`
  - `avatarUrl` → `photoURL`
  - `email` → `email`
  - `mobile` → `phoneNumber`
- Only syncs if user has a `firebaseUid` (OAuth/phone auth users)
- Non-blocking: Database update succeeds even if Auth sync fails

## How It Works

1. User updates profile via frontend (Profile page, Dashboard, etc.)
2. Frontend calls `updateUser()` → `/api/users` (PUT)
3. API updates Firebase Realtime Database
4. **NEW**: API also updates Firebase Auth profile (if `firebaseUid` exists)
5. Both database and Auth profile stay in sync

## Setup Instructions

### For Local Development

1. **Get Firebase Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

2. **Set Environment Variable:**
   ```bash
   # In .env.local or your environment
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...",...}'
   ```
   
   Or set `GOOGLE_APPLICATION_CREDENTIALS` to point to the JSON file:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

### For Vercel/Production

**Option 1: Link Firebase Project (Recommended)**
1. Go to Vercel Dashboard → Your Project → Settings → Integrations
2. Connect Firebase integration
3. Select your Firebase project
4. Vercel will automatically use Application Default Credentials

**Option 2: Set Service Account Key**
1. Get service account key (same as local development)
2. In Vercel Dashboard → Your Project → Settings → Environment Variables
3. Add `FIREBASE_SERVICE_ACCOUNT_KEY` with the entire JSON as the value
4. Redeploy your application

**Option 3: Use FIREBASE_PROJECT_ID Only**
- If `FIREBASE_PROJECT_ID` is set, Firebase Admin will attempt to use Application Default Credentials
- This works if Firebase project is linked or if running on Google Cloud Platform

## Environment Variables

### Required
- `FIREBASE_PROJECT_ID` - Your Firebase project ID (e.g., `reride-ade6a`)

### Optional (for explicit setup)
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Full JSON string of service account key
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key file

## Testing

1. **Update a user profile** (name, avatar, email, mobile)
2. **Check Firebase Console:**
   - Realtime Database → `users` → user record should be updated
   - Authentication → Users → user profile should show updated `displayName`, `photoURL`, etc.

3. **Verify sync:**
   - If user logs in with Google/Phone, their profile should reflect the updates
   - Firebase Auth profile should match database record

## Notes

- **Non-blocking**: If Firebase Admin isn't configured, the database update still succeeds
- **Only for OAuth users**: Sync only happens if user has `firebaseUid` (Google/Phone auth)
- **Email updates**: Changing email in database will also update Firebase Auth email
- **Error handling**: Auth sync errors are logged but don't fail the user update operation

## Troubleshooting

### "Firebase Admin not initialized" warning
- **Cause**: Firebase Admin SDK credentials not configured
- **Fix**: Set up one of the initialization methods above

### Auth profile not updating
- Check that user has `firebaseUid` field in database
- Verify Firebase Admin is initialized (check server logs)
- Check Firebase Console → Authentication → Users for the user

### Service Account Key errors
- Ensure JSON is valid and properly escaped if set as environment variable
- Check that service account has "Firebase Admin SDK Administrator Service Agent" role
- Verify project ID matches in service account and environment variables

## Files Changed

1. `lib/firebase-admin.ts` - **NEW** - Firebase Admin SDK initialization and Auth profile update
2. `api/main.ts` - Updated user PUT endpoint to sync Firebase Auth profile

## Benefits

✅ **Bidirectional Sync**: Database ↔ Firebase Auth  
✅ **Consistent User Data**: Profile updates reflected everywhere  
✅ **Better UX**: Users see updated profile immediately after changes  
✅ **OAuth Compatibility**: Google/Phone auth users stay in sync  
✅ **Graceful Degradation**: Works even if Firebase Admin isn't configured

