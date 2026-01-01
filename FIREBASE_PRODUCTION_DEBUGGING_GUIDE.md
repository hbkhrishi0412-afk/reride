# Firebase Production Debugging Guide

## 🔍 Issue Summary

**Problem**: Firebase Realtime Database not working in production with error:
> "Firebase database is not available. Please check VITE_FIREBASE_* environment variables."

**Additional Issue**: Password updates fail with:
> "Your session has expired. Please log in again."

## ✅ Root Causes Identified

### 1. Missing `VITE_FIREBASE_DATABASE_URL` (CRITICAL)

**Issue**: The code requires `VITE_FIREBASE_DATABASE_URL` for client-side Realtime Database access, but only `FIREBASE_DATABASE_URL` is set.

**Why This Matters**:
- Vite only exposes environment variables prefixed with `VITE_` to client-side code via `import.meta.env`
- Variables without `VITE_` prefix (like `FIREBASE_DATABASE_URL`) are only available server-side via `process.env`
- Client-side code cannot access `FIREBASE_DATABASE_URL` - it needs `VITE_FIREBASE_DATABASE_URL`

### 2. Firebase Config Missing `databaseURL`

**Issue**: The Firebase app initialization in `lib/firebase.ts` didn't include `databaseURL` in the config object.

**Fix Applied**: Added `databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || ''` to `firebaseConfig`.

### 3. Session Expiration in Production

**Issue**: Firebase Auth tokens expire faster in production, and token refresh wasn't aggressive enough.

**Fix Applied**: Increased token refresh buffer from 60 seconds to 120 seconds to proactively refresh tokens before expiration.

## 🔧 Required Environment Variables

### For Vercel Production Deployment

You need **BOTH** sets of variables:

#### Client-Side Variables (Required for React/Vite frontend)
These must have the `VITE_` prefix:

```
VITE_FIREBASE_API_KEY=AIzaSyDym4_piy6jakV5YAwP9pzaj_iTuNwrJK4
VITE_FIREBASE_AUTH_DOMAIN=reride-ade6a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=reride-ade6a
VITE_FIREBASE_STORAGE_BUCKET=reride-ade6a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=712465065696
VITE_FIREBASE_APP_ID=1:712465065696:web:3bd8cab935e6ad76a19285
VITE_FIREBASE_DATABASE_URL=https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/
```

#### Server-Side Variables (Required for API routes/serverless)
These can use either prefix, but `FIREBASE_*` is preferred:

```
FIREBASE_API_KEY=AIzaSyDym4_piy6jakV5YAwP9pzaj_iTuNwrJK4
FIREBASE_AUTH_DOMAIN=reride-ade6a.firebaseapp.com
FIREBASE_PROJECT_ID=reride-ade6a
FIREBASE_STORAGE_BUCKET=reride-ade6a.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=712465065696
FIREBASE_APP_ID=1:712465065696:web:3bd8cab935e6ad76a19285
FIREBASE_DATABASE_URL=https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/
```

**Note**: `VITE_FIREBASE_DATABASE_URL` and `FIREBASE_DATABASE_URL` should have the **same value**.

## 📋 Step-by-Step Fix Instructions

### Step 1: Add Missing Environment Variable in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the missing variable:
   - **Key**: `VITE_FIREBASE_DATABASE_URL`
   - **Value**: `https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/`
   - **Environment**: Select **Production**, **Preview**, and **Development**
4. Click **Save**

### Step 2: Verify All Variables Are Set

Check that you have all 7 client-side variables:
- ✅ `VITE_FIREBASE_API_KEY`
- ✅ `VITE_FIREBASE_AUTH_DOMAIN`
- ✅ `VITE_FIREBASE_PROJECT_ID`
- ✅ `VITE_FIREBASE_STORAGE_BUCKET`
- ✅ `VITE_FIREBASE_MESSAGING_SENDER_ID`
- ✅ `VITE_FIREBASE_APP_ID`
- ✅ `VITE_FIREBASE_DATABASE_URL` ← **This was missing!**

### Step 3: Redeploy

**CRITICAL**: After adding environment variables, you **MUST** trigger a new deployment:

1. Go to **Deployments** tab in Vercel
2. Click **⋯** (three dots) on the latest deployment
3. Select **Redeploy**
4. Wait for deployment to complete

**Why**: Vite embeds environment variables at **build time**. Existing deployments won't have the new variable unless you rebuild.

### Step 4: Verify the Fix

After redeployment, check the browser console:

1. Open your production site
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. Look for Firebase initialization messages:
   - ✅ Should see: `✅ Firebase initialized successfully`
   - ✅ Should see: `databaseURL: "https://reride-ade6a-default-rtdb..."` (not "MISSING")
   - ❌ Should NOT see: `❌ VITE_FIREBASE_DATABASE_URL is missing`

## 🐛 Debugging Steps

### Check 1: Verify Environment Variables in Production

**Method 1: Check Console Logs (Recommended)**
When the page loads, check the browser console for Firebase initialization messages. You should see:
- `✅ Firebase initialized successfully` (if config is valid)
- `🔍 Firebase Config Debug (Dev):` or `⚠️ Firebase Config Issue (Production):` with configuration details
- Look for `databaseURL: "https://..."` (should NOT say "MISSING")

**Method 2: Check via Firebase Database Status (Browser Console)**
The easiest way to verify in the console is to check the database status:
```javascript
// This will work if you're on a page that has loaded the firebase-db module
// Look for the getDatabaseStatus function in your app, or check the console logs above
```

**Method 3: Check Network Tab**
1. Open DevTools → Network tab
2. Filter by `firebasedatabase`
3. Look for requests to your Firebase database URL
4. If you see requests, the database URL is configured correctly

**What to Look For:**
- ✅ `databaseURL: "https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/..."` (not "MISSING")
- ✅ `hasDatabaseURL: true` in the debug output
- ✅ Successful Firebase database requests in Network tab
- ❌ `databaseURL: "MISSING"` indicates `VITE_FIREBASE_DATABASE_URL` is not set

**Note:** You cannot directly access `import.meta.env` in the browser console (it only works in ES modules). The Firebase initialization code already logs all the important information - just check those logs!

### Check 2: Verify Firebase Database Status

**In Browser Console**:
```javascript
// Check database availability
import { getDatabaseStatus } from './lib/firebase-db';
const status = getDatabaseStatus();
console.log('Database Status:', status);
```

**Expected Output**:
```javascript
{
  available: true  // Should be true, not false
}
```

### Check 3: Network Tab Verification

1. Open **Network** tab in DevTools
2. Filter by `firebasedatabase`
3. Try to load a page that uses Firebase
4. Check for requests to `https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/`
5. **Should see**: Successful requests (200 status)
6. **Should NOT see**: 401/403 errors or connection failures

### Check 4: Firebase Console Verification

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `reride-ade6a`
3. Go to **Realtime Database** → **Data** tab
4. Verify data is accessible
5. Check **Rules** tab - ensure rules allow read/write for authenticated users

### Check 5: Session Expiration Debugging

**In Browser Console**:
```javascript
// Check token expiration
const token = localStorage.getItem('reRideAccessToken');
if (token) {
  const parts = token.split('.');
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = exp - now;
    console.log('Token expires in:', expiresIn, 'seconds');
    console.log('Token expires at:', new Date(exp * 1000).toLocaleString());
  }
}
```

**Expected**: Token should have at least 2 minutes (120 seconds) before expiration for proactive refresh to work.

## 🔍 Common Issues and Solutions

### Issue 1: "VITE_FIREBASE_DATABASE_URL is missing" in console

**Cause**: Variable not set in Vercel, or deployment happened before variable was added.

**Solution**:
1. Verify variable is set in Vercel (Settings → Environment Variables)
2. Ensure it's enabled for **Production** environment
3. **Redeploy** the application (Deployments → Redeploy)

### Issue 2: Database works in dev but not production

**Cause**: Different environment variable names or values between dev and production.

**Solution**:
1. Check `.env.local` has `VITE_FIREBASE_DATABASE_URL`
2. Verify Vercel has the same variable with same value
3. Ensure both use the exact same database URL

### Issue 3: "Session expired" on password update

**Cause**: Token expired before request completed, or token refresh failed.

**Solution**:
1. Check token expiration (see Check 5 above)
2. Verify `reRideRefreshToken` exists in localStorage
3. Check Network tab for `/api/users` request - should see token refresh attempt before password update
4. If refresh fails, user needs to log in again

### Issue 4: Variables set but still not working

**Possible Causes**:
1. **Build cache**: Vercel might be using cached build
   - **Fix**: Clear build cache in Vercel settings, then redeploy
2. **Wrong environment**: Variable set for wrong environment (Preview vs Production)
   - **Fix**: Ensure variable is enabled for **Production**
3. **Typo in variable name**: `VITE_FIREBASE_DATABASE_URL` vs `VITE_FIREBASE_DATABASE_UR` (missing L)
   - **Fix**: Double-check exact spelling
4. **Missing trailing slash**: Database URL should end with `/`
   - **Fix**: Ensure URL is `https://...firebasedatabase.app/` (with trailing slash)

## 📊 Verification Checklist

After applying fixes, verify:

- [ ] `VITE_FIREBASE_DATABASE_URL` is set in Vercel environment variables
- [ ] Variable is enabled for Production, Preview, and Development
- [ ] New deployment was triggered after adding variable
- [ ] Browser console shows `✅ Firebase initialized successfully`
- [ ] Browser console shows `databaseURL` is not "MISSING"
- [ ] `getDatabaseStatus()` returns `{ available: true }`
- [ ] Network tab shows successful requests to Firebase database
- [ ] Password update works without "session expired" error
- [ ] Firebase Console shows data is accessible

## 🚀 Quick Fix Summary

**The Critical Missing Variable**:
```
VITE_FIREBASE_DATABASE_URL=https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/
```

**Action Required**:
1. Add this variable to Vercel (Settings → Environment Variables)
2. Enable for Production, Preview, Development
3. **Redeploy** (Deployments → Redeploy)
4. Verify in browser console

## 📝 Code Changes Applied

### 1. `lib/firebase.ts`
- Added `databaseURL` to `firebaseConfig`
- Added database URL validation and logging
- Updated error messages to mention `VITE_FIREBASE_DATABASE_URL`

### 2. `lib/firebase-db.ts`
- Improved client-side database URL detection
- Added fallback to use databaseURL from Firebase app config
- Enhanced error messages with specific variable names
- Added production-specific warnings for missing database URL

### 3. `utils/authenticatedFetch.ts`
- Increased token refresh buffer from 60 to 120 seconds
- Better proactive token refresh for production reliability

## 🔗 Related Files

- `lib/firebase.ts` - Firebase app initialization
- `lib/firebase-db.ts` - Realtime Database initialization
- `utils/authenticatedFetch.ts` - Token refresh logic
- `components/AppProvider.tsx` - Password update with token refresh
- `env.example` - Environment variable template

## 📞 Still Having Issues?

If problems persist after following this guide:

1. **Check Vercel Build Logs**: Look for environment variable warnings
2. **Check Browser Console**: Look for Firebase initialization errors
3. **Check Network Tab**: Look for failed Firebase requests
4. **Verify Firebase Console**: Ensure database is accessible and rules are correct
5. **Test in Development**: Verify it works locally with `.env.local`

## ✅ Success Indicators

You'll know the fix worked when:

1. ✅ No "Firebase database is not available" errors
2. ✅ Database operations work (read/write data)
3. ✅ Password updates complete successfully
4. ✅ No "session expired" errors during operations
5. ✅ Browser console shows successful Firebase initialization
6. ✅ Network tab shows successful Firebase requests

---

**Last Updated**: After applying fixes for missing `VITE_FIREBASE_DATABASE_URL` and improved token refresh logic.

