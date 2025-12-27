# 🔥 Firebase Environment Variables Production Fix

## Problem
You've set environment variables in Vercel, but you're still seeing the Firebase configuration error in production.

## Root Cause
**Vite embeds environment variables at BUILD TIME**, not runtime. This means:
1. Environment variables must be set in Vercel **BEFORE** the build happens
2. If you set variables after a build, they won't be in the bundle
3. You must trigger a **new deployment** after setting variables

## Solution Steps

### Step 1: Verify Variables Are Set in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Verify all 6 Firebase variables are present:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
5. **CRITICAL**: Make sure each variable is enabled for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

### Step 2: Trigger a New Deployment
After setting/updating environment variables, you **MUST** redeploy:

**Option A: Redeploy from Vercel Dashboard**
1. Go to **Deployments** tab
2. Find your latest deployment
3. Click the **"..."** menu (three dots)
4. Click **"Redeploy"**
5. Wait for the build to complete

**Option B: Push a New Commit**
```bash
git commit --allow-empty -m "Trigger rebuild with Firebase env vars"
git push
```

**Option C: Force Redeploy via Vercel CLI**
```bash
vercel --prod --force
```

### Step 3: Verify the Fix
1. Wait for deployment to complete (usually 2-5 minutes)
2. Visit your production site: `https://www.reride.co.in`
3. Try to login - the error should be gone
4. Open browser console (F12) and check for any Firebase errors

## Code Changes Applied

The code has been updated to:
1. ✅ Use **direct static references** to `import.meta.env` (required by Vite)
2. ✅ Add debug logging in development mode
3. ✅ Better error messages for production vs development

## Why This Happens

Vite uses **static analysis** during build to determine which environment variables to include. When you use:
```javascript
// ❌ This doesn't work - Vite can't detect which variables are needed
const value = import.meta.env[key];
```

Vite needs:
```javascript
// ✅ This works - Vite can statically analyze and include the variable
const value = import.meta.env.VITE_FIREBASE_API_KEY;
```

## Troubleshooting

### Still seeing the error after redeploy?

1. **Check build logs in Vercel:**
   - Go to Deployments → Click on the deployment
   - Check the build logs for any errors
   - Look for "Environment Variables" section

2. **Verify variables are actually set:**
   - In Vercel Dashboard → Settings → Environment Variables
   - Click the eye icon next to each variable
   - Make sure values are not empty

3. **Check variable names:**
   - Must start with `VITE_` prefix
   - Must match exactly (case-sensitive)
   - No extra spaces or quotes

4. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or open in incognito/private window

5. **Check deployment environment:**
   - Make sure you're checking the **Production** deployment
   - Preview deployments use Preview environment variables

### Debug in Browser Console

Open browser console (F12) and check:
```javascript
// Check if variables are available
console.log('API Key:', import.meta.env.VITE_FIREBASE_API_KEY);
console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
```

If these are `undefined`, the variables weren't included in the build.

## Quick Checklist

- [ ] All 6 Firebase variables set in Vercel
- [ ] Variables enabled for Production environment
- [ ] New deployment triggered after setting variables
- [ ] Build completed successfully
- [ ] Tested in production - no errors
- [ ] Browser cache cleared

## Need More Help?

1. Check Vercel build logs for errors
2. Verify Firebase project is active in Firebase Console
3. Ensure Firebase project settings match the environment variables
4. Check `FIREBASE_QUICK_SETUP.md` for detailed setup instructions

---

**Remember**: Environment variables in Vite are **build-time**, not runtime. Always redeploy after changing them!

