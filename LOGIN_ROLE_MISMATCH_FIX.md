# Login Role Mismatch Issue - Fix Guide

## Problem
When trying to log in with `speedy@auto.com` on the customer login page, you get the error:
**"User is not a registered customer."**

## Root Cause
The user exists in Firebase Realtime Database, but there's a **role mismatch**:
- **User in Firebase**: `role: "seller"`
- **Login attempt**: Trying to log in as `role: "customer"`

The authentication code checks if the user's role matches the requested role. Since `speedy@auto.com` is registered as a "seller" but you're trying to log in as a "customer", the login fails.

## Solution Options

### Option 1: Change User Role in Firebase (Recommended)
If this user should be a customer:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **reride**
3. Navigate to **Realtime Database** → **Data** tab
4. Find the user under `users` → `speedy@auto_com` (note: dots in emails become underscores in Firebase keys)
5. Change the `role` field from `"seller"` to `"customer"`
6. Save the changes
7. Try logging in again

### Option 2: Use Seller Login Page
If this user should remain a seller:
- Use the **Seller Login** page instead of the Customer Login page
- The seller login page expects `role: "seller"`, which matches your user's role

## Technical Details

### Email to Firebase Key Conversion
Firebase Realtime Database doesn't allow certain special characters (like dots) in keys. The system automatically converts emails to Firebase-safe keys:

```typescript
function emailToKey(email: string): string {
  return email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
}
```

So:
- Email: `speedy@auto.com`
- Firebase Key: `speedy@auto_com` (dot replaced with underscore)

### Role Check in Authentication
The authentication code in `api/main.ts` (line 772-773) checks:
```typescript
if (sanitizedData.role && user.role !== sanitizedData.role) {
  return res.status(403).json({ 
    success: false, 
    reason: `User is not a registered ${sanitizedData.role}.` 
  });
}
```

This is why you see the specific error message.

## Verification
After fixing the role:
1. The user should be able to log in successfully
2. The user will have access to customer features
3. The error message will no longer appear



