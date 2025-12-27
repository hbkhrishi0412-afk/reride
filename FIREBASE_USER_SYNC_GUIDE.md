# Firebase User Sync Guide

## Overview

This guide explains how to sync all your existing users from MongoDB to Firebase Authentication.

## Prerequisites

1. ✅ Firebase project created
2. ✅ Firebase Admin SDK service account key
3. ✅ MongoDB connection string
4. ✅ All users in MongoDB database

## Step 1: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate new private key**
6. Save the JSON file as `firebase-service-account.json` in your project root

**⚠️ Important:** Never commit this file to Git! Add it to `.gitignore`:

```gitignore
firebase-service-account.json
```

## Step 2: Set Environment Variables

Make sure you have `MONGODB_URI` set:

```bash
# In .env.local or environment
MONGODB_URI=your_mongodb_connection_string
```

## Step 3: Install Firebase Admin SDK

```bash
npm install firebase-admin
```

## Step 4: Run the Sync Script

```bash
node scripts/sync-users-to-firebase.js
```

## What the Script Does

1. **Connects to Firebase Admin** - Initializes Firebase Admin SDK
2. **Connects to MongoDB** - Fetches all users from database
3. **Creates Firebase Users** - Creates each user in Firebase Authentication
4. **Sets Custom Claims** - Adds role and authProvider as custom claims
5. **Sets Passwords** - Sets passwords for email/password users
6. **Updates MongoDB** - Updates each user with `firebaseUid`

## User Data Mapping

| MongoDB Field | Firebase Auth Field |
|--------------|---------------------|
| `email` | `email` |
| `name` | `displayName` |
| `avatarUrl` | `photoURL` |
| `mobile` | `phoneNumber` (formatted with +91) |
| `status: 'inactive'` | `disabled: true` |
| `isVerified` | `emailVerified` |
| `role` | Custom Claim |
| `authProvider` | Custom Claim |

## Expected Output

```
🚀 Starting User Sync to Firebase...

════════════════════════════════════════════════════════════

✅ Firebase Admin initialized
✅ Connected to MongoDB
📥 Fetching users from MongoDB...
✅ Found 25 users in database

🔄 Processing users...

[1/25] Processing: user@example.com (customer)
✅ Created Firebase user for user@example.com (UID: abc123...)
✅ Set custom claims for user@example.com (role: customer)
✅ Set password for user@example.com
✅ Updated MongoDB user with Firebase UID: abc123...

...

════════════════════════════════════════════════════════════
📊 Sync Summary:
════════════════════════════════════════════════════════════
Total users:     25
✅ Created:       20
🔄 Updated:       5
⏭️  Existing:      0
❌ Failed:        0

✅ Sync completed!
```

## Handling Different Auth Providers

### Email/Password Users
- Password is set in Firebase
- Can login with email/password

### Google OAuth Users
- Already have Firebase UID (created during OAuth)
- Script will verify and update if needed

### Phone OTP Users
- Phone number is set in Firebase
- Can login with phone OTP

## Troubleshooting

### Error: "Firebase service account file not found"
**Solution:** Download service account key from Firebase Console and save as `firebase-service-account.json` in project root.

### Error: "MONGODB_URI not found"
**Solution:** Set `MONGODB_URI` in your `.env.local` file or environment variables.

### Error: "auth/email-already-exists"
**Solution:** This is normal - the script will use the existing Firebase user and update MongoDB with the UID.

### Error: "Could not set password"
**Solution:** This happens for OAuth users (Google/Phone). It's safe to ignore.

### Rate Limiting
**Solution:** The script includes a 100ms delay between users to avoid rate limits. If you still hit limits, increase the delay.

## Verification

After syncing, verify users in Firebase Console:

1. Go to Firebase Console → **Authentication** → **Users**
2. You should see all your users listed
3. Check that custom claims are set (role, authProvider)

## Security Notes

1. **Service Account Key:** Keep it secure, never commit to Git
2. **Passwords:** Only set for email/password users
3. **Custom Claims:** Used for role-based access control
4. **Phone Numbers:** Automatically formatted with country code (+91 for India)

## Next Steps

After syncing:

1. ✅ Test login with email/password users
2. ✅ Test Google Sign-In (should work automatically)
3. ✅ Test Phone OTP (should work automatically)
4. ✅ Verify custom claims in your app

## Manual User Creation (Alternative)

If you prefer to create users manually in Firebase Console:

1. Go to Firebase Console → Authentication → Users
2. Click "Add user"
3. Enter email and password
4. Set display name and other fields
5. Update MongoDB with the Firebase UID

---

**Note:** This script is idempotent - you can run it multiple times safely. It will:
- Skip users that already have Firebase UIDs
- Update users if Firebase UID is missing
- Recreate users if Firebase UID is invalid

