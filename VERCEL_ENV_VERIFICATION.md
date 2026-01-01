# Vercel Environment Variables Verification Guide

## 📋 Complete List of Required Environment Variables

### 🔥 Client-Side Variables (VITE_ prefix)
**Required for:** React/Vite frontend (embedded at build time)

These **MUST** be set in Vercel for the frontend to work:

1. ✅ `VITE_FIREBASE_API_KEY`
2. ✅ `VITE_FIREBASE_AUTH_DOMAIN`
3. ✅ `VITE_FIREBASE_PROJECT_ID`
4. ✅ `VITE_FIREBASE_STORAGE_BUCKET`
5. ✅ `VITE_FIREBASE_MESSAGING_SENDER_ID`
6. ✅ `VITE_FIREBASE_APP_ID`
7. ✅ `VITE_FIREBASE_DATABASE_URL` ← **Critical for Realtime Database**

### 🔧 Server-Side Variables (FIREBASE_ prefix)
**Required for:** API routes and serverless functions

These **MUST** be set in Vercel for the backend to work:

1. ✅ `FIREBASE_API_KEY` (same value as VITE_FIREBASE_API_KEY)
2. ✅ `FIREBASE_AUTH_DOMAIN` (same value as VITE_FIREBASE_AUTH_DOMAIN)
3. ✅ `FIREBASE_PROJECT_ID` (same value as VITE_FIREBASE_PROJECT_ID)
4. ✅ `FIREBASE_STORAGE_BUCKET` (same value as VITE_FIREBASE_STORAGE_BUCKET)
5. ✅ `FIREBASE_MESSAGING_SENDER_ID` (same value as VITE_FIREBASE_MESSAGING_SENDER_ID)
6. ✅ `FIREBASE_APP_ID` (same value as VITE_FIREBASE_APP_ID)
7. ✅ `FIREBASE_DATABASE_URL` (same value as VITE_FIREBASE_DATABASE_URL)

### 🔐 Other Required Variables

1. ✅ `JWT_SECRET` - For authentication token signing
2. ⚠️ `MONGODB_URI` - (Optional/Deprecated - only if still using MongoDB)
3. ⚠️ `GEMINI_API_KEY` - (Optional - only if using AI features)

## 🔍 How to Check Environment Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `reride` (or your project name)

2. **Navigate to Environment Variables**
   - Click on **Settings** tab (left sidebar)
   - Click on **Environment Variables** (under Configuration)

3. **Verify Each Variable**
   - Check that all variables listed above are present
   - Verify they're enabled for the correct environments:
     - ✅ **Production**
     - ✅ **Preview** (optional but recommended)
     - ✅ **Development** (optional but recommended)

4. **Check Variable Values** (if needed)
   - Click the eye icon (👁️) to view value (masked)
   - Click **Edit** to modify if needed
   - **Note:** You can't copy the value directly for security reasons

### Method 2: Verify in Production (Browser Console)

After deployment, check the browser console for Firebase initialization:

1. **Open Your Production Site**
   - Visit: `https://your-app.vercel.app`
   - Or: `https://your-app.vercel.app` (your production domain)

2. **Open Browser DevTools**
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
   - Press `Cmd+Option+I` (Mac)
   - Go to **Console** tab

3. **Look for Firebase Initialization Messages**
   - ✅ **Success:** `✅ Firebase initialized successfully`
   - ✅ **Config Check:** Look for `🔍 Firebase Config Debug` or `⚠️ Firebase Config Issue`
   - ❌ **Error:** `❌ VITE_FIREBASE_DATABASE_URL is missing` or similar

4. **Check Database URL**
   - In the console logs, look for: `databaseURL: "https://...firebasedatabase.app/..."`
   - Should **NOT** say `"MISSING"`

### Method 3: Verify via API Endpoint (Server-Side Variables)

Test if server-side variables are set correctly:

```bash
# Test database health (requires FIREBASE_DATABASE_URL)
curl https://your-app.vercel.app/api/db-health

# Expected: {"status":"ok","message":"Database connected successfully"}
# If error: Check FIREBASE_DATABASE_URL and other server-side variables
```

## ✅ Verification Checklist

Use this checklist to ensure everything is configured correctly:

### Client-Side Variables (VITE_ prefix)
- [ ] `VITE_FIREBASE_API_KEY` is set in Vercel
- [ ] `VITE_FIREBASE_AUTH_DOMAIN` is set in Vercel
- [ ] `VITE_FIREBASE_PROJECT_ID` is set in Vercel
- [ ] `VITE_FIREBASE_STORAGE_BUCKET` is set in Vercel
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID` is set in Vercel
- [ ] `VITE_FIREBASE_APP_ID` is set in Vercel
- [ ] `VITE_FIREBASE_DATABASE_URL` is set in Vercel ⚠️ **Critical!**
- [ ] All variables are enabled for **Production** environment
- [ ] Browser console shows `✅ Firebase initialized successfully`
- [ ] Browser console shows `databaseURL: "https://..."` (not "MISSING")

### Server-Side Variables (FIREBASE_ prefix)
- [ ] `FIREBASE_API_KEY` is set in Vercel
- [ ] `FIREBASE_AUTH_DOMAIN` is set in Vercel
- [ ] `FIREBASE_PROJECT_ID` is set in Vercel
- [ ] `FIREBASE_STORAGE_BUCKET` is set in Vercel
- [ ] `FIREBASE_MESSAGING_SENDER_ID` is set in Vercel
- [ ] `FIREBASE_APP_ID` is set in Vercel
- [ ] `FIREBASE_DATABASE_URL` is set in Vercel ⚠️ **Critical!**
- [ ] All variables are enabled for **Production** environment
- [ ] API endpoints work correctly (test `/api/db-health`)

### Other Variables
- [ ] `JWT_SECRET` is set in Vercel (at least 32 characters)
- [ ] `JWT_SECRET` is enabled for **Production** environment
- [ ] Login/authentication works correctly

## 🚨 Common Issues and Solutions

### Issue 1: Variables Set But Not Working

**Symptoms:**
- Variables are set in Vercel dashboard
- But app still shows "MISSING" in console
- Firebase initialization fails

**Solution:**
1. **Redeploy your application** - This is CRITICAL!
   - Vite embeds environment variables at **build time**
   - Go to **Deployments** tab in Vercel
   - Click **⋯** (three dots) on latest deployment
   - Select **Redeploy**
   - Wait for deployment to complete

2. **Verify Environment Selection**
   - In Vercel, ensure variables are enabled for **Production**
   - Check that you're viewing the Production environment (not Preview)

3. **Clear Browser Cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

### Issue 2: Database URL Missing

**Symptoms:**
- `databaseURL: "MISSING"` in console
- Database operations fail
- Error: "VITE_FIREBASE_DATABASE_URL is missing"

**Solution:**
1. Add `VITE_FIREBASE_DATABASE_URL` to Vercel
   - Value: `https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/`
   - **Note:** Include trailing slash `/`
   - Enable for **Production** environment

2. **Redeploy** after adding the variable

3. Verify in browser console after redeployment

### Issue 3: Server-Side Variables Not Working

**Symptoms:**
- Client-side works fine
- But API endpoints return 500 errors
- Database operations fail in API routes

**Solution:**
1. Verify `FIREBASE_DATABASE_URL` (without VITE_ prefix) is set
2. Verify all `FIREBASE_*` variables (without VITE_ prefix) are set
3. Check Vercel function logs for specific errors
4. Redeploy if variables were just added

### Issue 4: Variables Work Locally But Not in Production

**Symptoms:**
- Works fine in development (`npm run dev`)
- Fails in production

**Solution:**
1. **Check `.env.local` vs Vercel**
   - Local development uses `.env.local`
   - Production uses Vercel Environment Variables
   - They are **separate** - variables must be set in BOTH places

2. **Verify VITE_ prefix**
   - Client-side variables MUST have `VITE_` prefix in Vercel
   - Variables without `VITE_` prefix won't be available to client code

3. **Redeploy after changes**
   - Vercel environment variables are embedded at build time
   - Must redeploy to pick up changes

## 📝 Quick Reference: Expected Values

Based on your `env.example` file, here are the expected values:

```bash
# Client-Side (VITE_ prefix)
VITE_FIREBASE_API_KEY=AIzaSyDym4_piy6jakV5YAwP9pzaj_iTuNwrJK4
VITE_FIREBASE_AUTH_DOMAIN=reride-ade6a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=reride-ade6a
VITE_FIREBASE_STORAGE_BUCKET=reride-ade6a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=712465065696
VITE_FIREBASE_APP_ID=1:712465065696:web:3bd8cab935e6ad76a19285
VITE_FIREBASE_DATABASE_URL=https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/

# Server-Side (FIREBASE_ prefix - same values)
FIREBASE_API_KEY=AIzaSyDym4_piy6jakV5YAwP9pzaj_iTuNwrJK4
FIREBASE_AUTH_DOMAIN=reride-ade6a.firebaseapp.com
FIREBASE_PROJECT_ID=reride-ade6a
FIREBASE_STORAGE_BUCKET=reride-ade6a.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=712465065696
FIREBASE_APP_ID=1:712465065696:web:3bd8cab935e6ad76a19285
FIREBASE_DATABASE_URL=https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/

# Other
JWT_SECRET=<your-secret-here> (at least 32 characters)
```

## 🔄 Step-by-Step Verification Process

1. **Check Vercel Dashboard**
   - [ ] Go to Settings → Environment Variables
   - [ ] Verify all required variables are present
   - [ ] Verify they're enabled for Production

2. **Redeploy Application**
   - [ ] Go to Deployments tab
   - [ ] Click Redeploy on latest deployment
   - [ ] Wait for deployment to complete

3. **Verify in Browser Console**
   - [ ] Open production site
   - [ ] Open DevTools → Console
   - [ ] Check for Firebase initialization messages
   - [ ] Verify databaseURL is not "MISSING"

4. **Test API Endpoints**
   - [ ] Test `/api/db-health` endpoint
   - [ ] Verify login/authentication works
   - [ ] Test database operations

5. **If Issues Persist**
   - [ ] Check Vercel function logs
   - [ ] Verify Firebase Console settings
   - [ ] Review error messages in browser console
   - [ ] Check network tab for failed requests

## 💡 Pro Tips

1. **Always Redeploy After Adding Variables**
   - Vite builds environment variables into the bundle
   - Changes won't take effect until you redeploy

2. **Use Environment-Specific Variables**
   - Set variables for Production, Preview, and Development separately if needed
   - This allows different configs for different environments

3. **Double-Check Variable Names**
   - Common mistake: `FIREBASE_DATABASE_URL` vs `VITE_FIREBASE_DATABASE_URL`
   - Client-side MUST have `VITE_` prefix
   - Server-side should NOT have `VITE_` prefix

4. **Verify Values Match**
   - `VITE_FIREBASE_*` and `FIREBASE_*` should have the same values
   - Only difference is the prefix

5. **Check for Trailing Slashes**
   - Database URL should end with `/`
   - Example: `https://...firebasedatabase.app/`

---

**Last Updated:** After implementing comprehensive token refresh and Firebase configuration fixes

