# 🔥 Fix: Firebase Unauthorized Domain Error

## Error Message
```
Firebase: Error (auth/unauthorized-domain)
```

## What This Means
Your domain `reride.co.in` is not authorized in Firebase Console. Firebase requires you to explicitly whitelist domains that can use authentication for security reasons.

## ✅ Solution: Add Domain to Firebase Console

### Step 1: Go to Firebase Console
1. Visit: https://console.firebase.google.com/
2. Select your project: **reride-ade6a**

### Step 2: Navigate to Authentication Settings
1. Click **Authentication** in the left sidebar
2. Click the **Settings** tab (gear icon at the top)
3. Scroll down to **Authorized domains**

### Step 3: Add Your Domain
1. Click **"Add domain"** button
2. Enter: `reride.co.in`
3. Click **"Add"**

### Step 4: Also Add Vercel Domain (if needed)
If you also want to test on Vercel preview deployments:
1. Click **"Add domain"** again
2. Enter: `*.vercel.app` (for all Vercel preview deployments)
   - OR add specific ones like: `your-project.vercel.app`

### Step 5: Verify
You should now see these domains in the authorized list:
- ✅ `localhost` (already there for development)
- ✅ `reride.co.in` (you just added)
- ✅ `*.vercel.app` (if you added it)

## 📋 Complete List of Domains to Add

Add these domains to Firebase Authorized domains:

1. **Production Domain:**
   - `reride.co.in`

2. **Vercel Preview Deployments (optional):**
   - `*.vercel.app` (wildcard for all Vercel previews)
   - OR specific ones like: `your-project-name.vercel.app`

3. **Development (usually already added):**
   - `localhost` (should already be there)

## 🔍 How to Verify It's Fixed

1. **Wait a few seconds** after adding the domain (Firebase updates are usually instant)
2. **Refresh your website**: `https://www.reride.co.in/login`
3. **Try Google Sign-In** - the error should be gone
4. **Check browser console** (F12) - no more `auth/unauthorized-domain` errors

## ⚠️ Important Notes

1. **No Redeployment Needed**: Unlike environment variables, authorized domains are configured in Firebase Console, not in your code. No redeployment is required.

2. **Changes Are Instant**: Domain authorization updates are usually applied immediately, but may take up to 1-2 minutes in rare cases.

3. **Security**: Only add domains you own. Don't add random domains as this could be a security risk.

4. **Subdomains**: If you have subdomains like `www.reride.co.in`, you may need to add both:
   - `reride.co.in`
   - `www.reride.co.in`

## 🐛 Still Not Working?

If you still see the error after adding the domain:

1. **Check Domain Spelling**: Make sure you typed `reride.co.in` exactly (no `www.` prefix unless you need it)

2. **Check Firebase Project**: Make sure you're editing the correct Firebase project (`reride-ade6a`)

3. **Clear Browser Cache**: 
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or use incognito/private window

4. **Wait a Minute**: Sometimes Firebase takes a moment to propagate changes

5. **Check Browser Console**: Look for any other errors that might give more clues

## 📸 Visual Guide

The authorized domains section in Firebase Console looks like this:

```
Authorized domains
─────────────────
localhost
reride.co.in          [Remove]
*.vercel.app          [Remove]
```

## ✅ Success Indicators

When it's working:
- ✅ No `auth/unauthorized-domain` error
- ✅ Google Sign-In popup opens
- ✅ Phone OTP works
- ✅ Authentication completes successfully

---

**Quick Fix Summary:**
1. Go to Firebase Console → Authentication → Settings
2. Add `reride.co.in` to Authorized domains
3. Refresh your website
4. Try signing in again

That's it! No code changes or redeployment needed.

