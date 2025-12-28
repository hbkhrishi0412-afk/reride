# Firebase Admin SDK Fix for Serverless Functions

## Problem

Serverless functions (Vercel) were getting **Permission denied** errors when trying to read from Firebase Realtime Database:

```
❌ Firebase read error at users/irnm413@gmail_com: Error: Permission denied
```

## Root Cause

1. **Serverless functions don't have Firebase Auth context** - They run without an authenticated user
2. **Security rules require authentication** - Rules check `auth != null`, which fails in serverless
3. **Client SDK is subject to rules** - The regular Firebase client SDK respects security rules

## Solution

Created **Firebase Admin SDK** database service that **bypasses security rules** for server-side operations.

### Files Created/Modified

1. **`lib/firebase-admin-db.ts`** (NEW)
   - Admin SDK database operations
   - Bypasses security rules
   - Same API as client SDK for easy migration

2. **`services/firebase-user-service.ts`** (UPDATED)
   - Auto-detects server vs client context
   - Uses Admin SDK in serverless functions
   - Uses client SDK in browser

## How It Works

```typescript
// Auto-detection
const isServerSide = typeof window === 'undefined';

// Use Admin SDK in server, client SDK in browser
const dbRead = isServerSide ? adminRead : read;
```

When running in:
- **Serverless function** (`typeof window === 'undefined'`): Uses Admin SDK (bypasses rules)
- **Browser**: Uses client SDK (respects rules)

## Setup Required

### 1. Set Firebase Service Account Key in Vercel

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Copy the JSON content
4. In Vercel: Settings → Environment Variables
5. Add `FIREBASE_SERVICE_ACCOUNT_KEY` with the JSON as value

**OR**

### 2. Link Firebase Project in Vercel

1. Vercel Dashboard → Your Project → Settings → Integrations
2. Add Firebase integration
3. Select your Firebase project

This automatically provides Application Default Credentials.

### 3. Set Database URL

Ensure `FIREBASE_DATABASE_URL` is set in Vercel environment variables:
```
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app
```

## Testing

After deployment, serverless functions should:
- ✅ Read users without permission errors
- ✅ Create/update/delete data
- ✅ Query by fields
- ✅ Access all collections

## Next Steps

Consider updating other services to use Admin SDK in server context:
- `services/firebase-vehicle-service.ts`
- `services/firebase-conversation-service.ts`

Use the same pattern:
```typescript
const isServerSide = typeof window === 'undefined';
const dbRead = isServerSide ? adminRead : read;
```

## Security Notes

⚠️ **Important**: Admin SDK bypasses ALL security rules. Ensure:
- ✅ Server-side validation of business logic (sellerEmail match, etc.)
- ✅ Input validation and sanitization
- ✅ Rate limiting on API routes
- ✅ Authentication checks in API handlers (JWT validation)

Security rules still protect:
- ✅ Client-side direct database access
- ✅ Browser-based operations
- ✅ Unauthenticated access

