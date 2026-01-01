# 🚀 Vercel Environment Variables Setup Guide

This guide will help you set up all required environment variables in Vercel to fix the 401 and 503 errors.

## 📋 Quick Checklist

You need to add **17 environment variables** to Vercel:

### Client-Side Firebase Variables (7)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL`

### Server-Side Firebase Variables (7)
- `FIREBASE_API_KEY` (same value as VITE_FIREBASE_API_KEY)
- `FIREBASE_AUTH_DOMAIN` (same value as VITE_FIREBASE_AUTH_DOMAIN)
- `FIREBASE_PROJECT_ID` (same value as VITE_FIREBASE_PROJECT_ID)
- `FIREBASE_STORAGE_BUCKET` (same value as VITE_FIREBASE_STORAGE_BUCKET)
- `FIREBASE_MESSAGING_SENDER_ID` (same value as VITE_FIREBASE_MESSAGING_SENDER_ID)
- `FIREBASE_APP_ID` (same value as VITE_FIREBASE_APP_ID)
- `FIREBASE_DATABASE_URL` (same value as VITE_FIREBASE_DATABASE_URL)

### Other Required Variables (3)
- `JWT_SECRET`
- `MONGODB_URI`
- `GEMINI_API_KEY`

---

## 🔧 Step-by-Step Setup

### Step 1: Go to Vercel Dashboard

1. Visit [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project (`reride-2` or similar)
3. Click **Settings** in the top navigation
4. Click **Environment Variables** in the left sidebar

### Step 2: Add Firebase Variables

#### Client-Side Variables (VITE_ prefix)

Add these 7 variables one by one:

1. **VITE_FIREBASE_API_KEY**
   - Key: `VITE_FIREBASE_API_KEY`
   - Value: Your Firebase API key (from Firebase Console)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

2. **VITE_FIREBASE_AUTH_DOMAIN**
   - Key: `VITE_FIREBASE_AUTH_DOMAIN`
   - Value: `your-project-id.firebaseapp.com`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

3. **VITE_FIREBASE_PROJECT_ID**
   - Key: `VITE_FIREBASE_PROJECT_ID`
   - Value: Your Firebase project ID
   - Environments: ✅ Production, ✅ Preview, ✅ Development

4. **VITE_FIREBASE_STORAGE_BUCKET**
   - Key: `VITE_FIREBASE_STORAGE_BUCKET`
   - Value: `your-project-id.appspot.com`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

5. **VITE_FIREBASE_MESSAGING_SENDER_ID**
   - Key: `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - Value: Your messaging sender ID (numeric)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

6. **VITE_FIREBASE_APP_ID**
   - Key: `VITE_FIREBASE_APP_ID`
   - Value: Your app ID (format: `1:123456789:web:abcdef...`)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

7. **VITE_FIREBASE_DATABASE_URL**
   - Key: `VITE_FIREBASE_DATABASE_URL`
   - Value: `https://your-project-id-default-rtdb.region.firebasedatabase.app/`
   - ⚠️ **Important:** Must end with `/`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

#### Server-Side Variables (without VITE_ prefix)

Add these 7 variables with the **same values** as above:

1. **FIREBASE_API_KEY** = same value as `VITE_FIREBASE_API_KEY`
2. **FIREBASE_AUTH_DOMAIN** = same value as `VITE_FIREBASE_AUTH_DOMAIN`
3. **FIREBASE_PROJECT_ID** = same value as `VITE_FIREBASE_PROJECT_ID`
4. **FIREBASE_STORAGE_BUCKET** = same value as `VITE_FIREBASE_STORAGE_BUCKET`
5. **FIREBASE_MESSAGING_SENDER_ID** = same value as `VITE_FIREBASE_MESSAGING_SENDER_ID`
6. **FIREBASE_APP_ID** = same value as `VITE_FIREBASE_APP_ID`
7. **FIREBASE_DATABASE_URL** = same value as `VITE_FIREBASE_DATABASE_URL`

**Why both?**
- `VITE_*` variables are embedded in the client bundle at build time
- `FIREBASE_*` variables are needed for serverless functions at runtime
- Serverless functions can't access `VITE_*` variables

### Step 3: Add JWT_SECRET

1. **Generate JWT_SECRET** (if you don't have one):
   ```bash
   node scripts/generate-jwt-secret.js
   ```
   This will output a secure 64-character hex string.

2. **Add to Vercel:**
   - Key: `JWT_SECRET`
   - Value: The generated secret (or your existing one)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

⚠️ **Critical:** If you change `JWT_SECRET`, all existing tokens will become invalid. Users will need to log in again.

### Step 4: Add Other Variables

1. **MONGODB_URI**
   - Key: `MONGODB_URI`
   - Value: Your MongoDB connection string
   - Environments: ✅ Production, ✅ Preview, ✅ Development

2. **GEMINI_API_KEY**
   - Key: `GEMINI_API_KEY`
   - Value: Your Google Gemini API key
   - Environments: ✅ Production, ✅ Preview, ✅ Development

### Step 5: Verify All Variables

After adding all variables, verify:

- [ ] All 7 `VITE_FIREBASE_*` variables are set
- [ ] All 7 `FIREBASE_*` variables are set (without VITE_ prefix)
- [ ] `JWT_SECRET` is set
- [ ] `MONGODB_URI` is set
- [ ] `GEMINI_API_KEY` is set
- [ ] All variables are enabled for Production, Preview, and Development

### Step 6: Redeploy

**CRITICAL:** After adding environment variables, you MUST redeploy:

1. Go to **Deployments** tab
2. Click the **three dots (⋯)** on your latest deployment
3. Select **Redeploy**
4. Wait 2-3 minutes for deployment to complete

### Step 7: Clear Browser Tokens and Re-login

After redeploy:

1. Open browser console (F12)
2. Run:
   ```javascript
   localStorage.removeItem('reRideAccessToken');
   localStorage.removeItem('reRideRefreshToken');
   localStorage.removeItem('reRideCurrentUser');
   sessionStorage.clear();
   ```
3. Refresh the page
4. Log in again
5. Test password update

---

## 🔍 Finding Your Firebase Values

### Option 1: Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the **⚙️ gear icon** → **Project settings**
4. Scroll to **"Your apps"** section
5. Click on your web app (or create one)
6. Copy the config values

### Option 2: Your Local .env.local File

If you have a local `.env.local` file, you can copy values from there:

```env
VITE_FIREBASE_API_KEY=your_value_here
VITE_FIREBASE_AUTH_DOMAIN=your_value_here
# ... etc
```

**Important:** Copy the same values for both `VITE_FIREBASE_*` and `FIREBASE_*` variables.

---

## 🐛 Troubleshooting

### Issue: Still getting 401 errors

**Solution:**
1. Verify `JWT_SECRET` is set correctly in Vercel
2. Clear browser tokens and log in again
3. Check Vercel function logs for JWT errors

### Issue: Still getting 503 errors

**Solution:**
1. Verify all `FIREBASE_*` variables (without VITE_ prefix) are set
2. Check `FIREBASE_DATABASE_URL` format (must end with `/`)
3. Redeploy after adding variables
4. Check Vercel function logs for Firebase errors

### Issue: "JWT_SECRET is not defined"

**Solution:**
1. Add `JWT_SECRET` to Vercel environment variables
2. Enable for Production, Preview, Development
3. Redeploy application

### Issue: "Firebase database is not available"

**Solution:**
1. Verify all 7 `FIREBASE_*` variables are set (without VITE_ prefix)
2. Check `FIREBASE_DATABASE_URL` format
3. Redeploy application

---

## ✅ Verification Script

Run this locally to check what's missing:

```bash
node scripts/verify-vercel-env.js
```

This will show you which variables need to be added to Vercel.

---

## 📝 Summary

**Total Variables Needed:** 17

- 7 × `VITE_FIREBASE_*` (client-side)
- 7 × `FIREBASE_*` (server-side, same values)
- 1 × `JWT_SECRET`
- 1 × `MONGODB_URI`
- 1 × `GEMINI_API_KEY`

**After Setup:**
1. ✅ Redeploy application
2. ✅ Clear browser tokens
3. ✅ Log in again
4. ✅ Test password update

---

**Need Help?** Check Vercel function logs for specific error messages.

