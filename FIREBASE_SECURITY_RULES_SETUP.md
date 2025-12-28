# Firebase Realtime Database Security Rules Setup Guide

## Overview

This guide explains how to set up Firebase Realtime Database security rules for your ReRide application. The rules are designed to:
- Allow public read access for published vehicles (browsing)
- Protect user passwords and sensitive data
- Allow authenticated users to manage their own data
- Enable admin users to manage all data
- Support serverless function access via Firebase Admin SDK

## Important Notes

⚠️ **Serverless Functions**: Your serverless functions (API routes) should use **Firebase Admin SDK** which bypasses security rules. These rules are primarily for **client-side access**.

⚠️ **User Keys**: Users are stored with email-based keys (special characters replaced with underscores), not Firebase UID keys.

## Setup Instructions

### 1. Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`reride-ade6a` or your project name)
3. Navigate to **Realtime Database** → **Rules** tab

### 2. Choose Your Rules File

You have two options:

**Option A: Simple Rules** (`firebase-database-rules-simple.json`)
- ✅ Easier to understand and maintain
- ✅ Works with basic authentication
- ⚠️ Less granular control
- **Recommended for**: Getting started quickly

**Option B: Advanced Rules** (`firebase-database-rules.json`)
- ✅ More granular access control
- ✅ Role-based admin access
- ⚠️ More complex, requires user role lookup structure
- **Recommended for**: Production with proper user role indexing

### 3. Copy Security Rules

Copy the contents of your chosen rules file and paste them into the Firebase Console rules editor.

### 4. Publish Rules

Click **Publish** to deploy the rules.

### 5. Important: Set Up Firebase Admin SDK

For serverless functions, you **must** use Firebase Admin SDK which bypasses security rules:

1. Get your Firebase Service Account Key:
   - Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file

2. Set environment variable in Vercel:
   - Go to Vercel Project → Settings → Environment Variables
   - Add `FIREBASE_SERVICE_ACCOUNT_KEY` with the entire JSON as the value
   - Or use individual fields if preferred

## Security Rules Breakdown

### Users Collection (`/users`)

**Access Control:**
- ✅ **Public Read**: Basic profile info (name, email, avatar, role, verification status) - for seller profiles
- 🔒 **Private Read**: Full user data (including mobile, passwords) - only by owner or admin
- ✏️ **Write**: Users can update their own data, admins can update any user
- 🚫 **Password**: Never readable by clients (only writable by owner/admin)

**Key Features:**
- Seller profiles are publicly readable (for vehicle listings)
- Sensitive fields (password, mobile, alternatePhone) are protected
- Admin-only fields (reportedCount, isBanned) are restricted

### Vehicles Collection (`/vehicles`)

**Access Control:**
- ✅ **Public Read**: Published vehicles (status == 'published')
- 🔒 **Private Read**: Unpublished/sold vehicles - only by seller or admin
- ✏️ **Write**: Sellers can create/update/delete their own vehicles, admins can manage all

**Key Features:**
- Published vehicles are publicly accessible (for browsing)
- Sellers can only manage vehicles with their email in `sellerEmail` field
- Validation ensures required fields (make, model, price, sellerEmail) are present

### Conversations Collection (`/conversations`)

**Access Control:**
- 🔒 **Read**: Only participants (customerId or sellerId matches user email) or admin
- ✏️ **Write**: Only participants can add messages, admins can manage all
- 🚫 **List Access**: No direct list access - must access by conversation ID

**Key Features:**
- Conversations are private between customer and seller
- Users can only see conversations they're part of
- New conversations can only be created by the customer or admin

### Other Collections

- **vehicleData**: Public read (brands/models data), admin write
- **newCars**: Public read, admin write
- **plans**: Public read (subscription plans), admin write
- **notifications**: Users can only read their own, admin write
- **rateLimits**: Users can read/write their own, admin full access

## Recommended Approach: Hybrid Model

For best results, use a **hybrid approach**:

1. **Client-side**: Use security rules for access control
2. **Server-side (API routes)**: Use Firebase Admin SDK (bypasses rules)

This gives you:
- ✅ Security for client-side access
- ✅ Full control in serverless functions
- ✅ No permission denied errors in API routes

## Limitations & Workarounds

### Issue: Serverless Functions Can't Read All Users

**Problem**: Security rules prevent reading all users from serverless functions.

**Solution**: Use Firebase Admin SDK for server-side operations (recommended):

```typescript
import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from '../lib/firebase-admin';

// Initialize Admin SDK
const app = initializeFirebaseAdmin();
if (app) {
  const db = admin.database();
  const usersSnapshot = await db.ref('users').once('value');
  // Admin SDK bypasses security rules
}
```

### Issue: Email-Based User Keys

**Problem**: Users are keyed by email (with special chars replaced), not Firebase UID.

**Solution**: The rules check both email and firebaseUid fields to match authenticated users.

### Issue: Querying Users by Email

**Problem**: Security rules don't easily support querying users by email from client.

**Solution**: 
- Use serverless API endpoints that use Admin SDK
- Or create an index structure if needed

## Testing Rules

### Test Public Vehicle Access
```javascript
// Should work without authentication
const db = getDatabase();
const vehiclesRef = ref(db, 'vehicles');
const snapshot = await get(query(vehiclesRef, orderByChild('status'), equalTo('published')));
```

### Test User Profile Access
```javascript
// Should work without authentication (public fields only)
const userRef = ref(db, 'users/seller@example_com');
const snapshot = await get(userRef);
// Can read: name, email, avatarUrl, role, isVerified, etc.
// Cannot read: password, mobile (unless authenticated as owner)
```

### Test Authenticated Access
```javascript
// After Firebase Auth login
const user = auth.currentUser;
const userRef = ref(db, `users/${emailToKey(user.email)}`);
const snapshot = await get(userRef);
// Can read all fields of own user
```

## Recommended Setup for Production

1. **Use Firebase Admin SDK** for all server-side operations (API routes)
2. **Use Security Rules** for client-side access control
3. **Set JWT_SECRET** in Vercel environment variables
4. **Set FIREBASE_SERVICE_ACCOUNT_KEY** for Admin SDK access
5. **Monitor** Firebase Console → Realtime Database → Usage for unauthorized access attempts

## Security Best Practices

1. ✅ **Never expose passwords** - rules prevent password reads
2. ✅ **Validate on write** - rules validate required fields
3. ✅ **Role-based access** - admins have elevated permissions
4. ✅ **Private conversations** - only participants can access
5. ✅ **Public browsing** - published vehicles are publicly readable
6. ✅ **Seller profiles** - basic info is public, sensitive data is private

## Troubleshooting

### Error: "Permission denied" when reading users
- **Cause**: Trying to read all users without admin role
- **Fix**: Use Admin SDK in serverless functions, or query specific user by key

### Error: "Permission denied" when creating vehicle
- **Cause**: sellerEmail doesn't match authenticated user's email
- **Fix**: Ensure user is authenticated and sellerEmail matches their email

### Error: "Permission denied" when reading conversation
- **Cause**: User is not a participant (customerId or sellerId)
- **Fix**: Ensure user email matches customerId or sellerId in conversation

## Next Steps

1. Deploy the rules to Firebase Console
2. Test with your application
3. Monitor Firebase Console for any permission errors
4. Adjust rules as needed based on your specific requirements

