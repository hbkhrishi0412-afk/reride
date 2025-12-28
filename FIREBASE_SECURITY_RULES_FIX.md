# Fix Firebase Realtime Database Security Rules

## Problem

The migration failed with `PERMISSION_DENIED` errors because Firebase Realtime Database security rules are blocking write operations.

## Solution

You need to update your Firebase Realtime Database security rules to allow writes during migration.

### Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **reride-ade6a**
3. Click on **Realtime Database** in the left sidebar
4. Click on the **Rules** tab

### Step 2: Update Security Rules

For migration purposes, temporarily use these rules to allow all reads and writes:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**⚠️ WARNING:** These rules allow anyone to read and write to your database. This is only for migration/testing. You MUST update them after migration!

### Step 3: Publish the Rules

1. Click **Publish** button
2. Confirm the changes

### Step 4: Run Migration Again

After updating the rules, run the migration again:

```bash
npm run migrate:mongodb-to-firebase
```

### Step 5: Update Rules for Production

After successful migration, update your rules to be more secure. Here's a better production-ready example:

```json
{
  "rules": {
    "users": {
      "$userId": {
        ".read": "auth != null && ($userId == auth.uid || root.child('users').child($userId).child('email').val() == auth.token.email)",
        ".write": "auth != null && ($userId == auth.uid || root.child('users').child($userId).child('email').val() == auth.token.email)"
      }
    },
    "vehicles": {
      ".read": true,
      ".write": "auth != null",
      "$vehicleId": {
        ".read": true,
        ".write": "auth != null && (data.child('sellerEmail').val() == auth.token.email || root.child('users').child(auth.uid).child('role').val() == 'admin')"
      }
    },
    "conversations": {
      "$conversationId": {
        ".read": "auth != null && (data.child('customerId').val() == auth.uid || data.child('sellerId').val() == auth.uid)",
        ".write": "auth != null && (data.child('customerId').val() == auth.uid || data.child('sellerId').val() == auth.uid)"
      }
    },
    "notifications": {
      "$userId": {
        ".read": "auth != null && $userId == auth.uid",
        ".write": "auth != null && $userId == auth.uid"
      }
    },
    "vehicleData": {
      ".read": true,
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'"
    },
    "newCars": {
      ".read": true,
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'"
    },
    "plans": {
      ".read": true,
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'"
    },
    "rateLimits": {
      ".read": false,
      ".write": false
    }
  }
}
```

## Quick Fix (Temporary - For Migration Only)

If you just want to migrate quickly, use these temporary rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**Remember to change these back after migration!**

## After Migration

1. ✅ Verify all data migrated successfully
2. ✅ Update security rules to production-ready rules
3. ✅ Test your application
4. ✅ Monitor Firebase Console for any unauthorized access

## Need Help?

If you're still having issues:
1. Check Firebase Console → Realtime Database → Rules tab
2. Verify you're using the correct Firebase project
3. Check that the database URL matches: `https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/`




