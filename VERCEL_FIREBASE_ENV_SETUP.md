# 🔥 Vercel Firebase Environment Variables Setup

## Your Firebase Configuration Values

Based on your Firebase config, here are the exact values to set in Vercel:

### Environment Variables to Add in Vercel

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these 6 variables (one at a time):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyDym4_piy6jakV5YAwP9pzaj_iTuNwrJK4` | Production, Preview, Development |
| `VITE_FIREBASE_AUTH_DOMAIN` | `reride-ade6a.firebaseapp.com` | Production, Preview, Development |
| `VITE_FIREBASE_PROJECT_ID` | `reride-ade6a` | Production, Preview, Development |
| `VITE_FIREBASE_STORAGE_BUCKET` | `reride-ade6a.firebasestorage.app` | Production, Preview, Development |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `712465065696` | Production, Preview, Development |
| `VITE_FIREBASE_APP_ID` | `1:712465065696:web:3bd8cab935e6ad76a19285` | Production, Preview, Development |

### Step-by-Step Instructions

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `reride` (or your project name)

2. **Navigate to Environment Variables**
   - Click **Settings** (left sidebar)
   - Click **Environment Variables** (under Settings)

3. **Add Each Variable**
   For each variable above:
   - Click **"Add New"** or **"Add"** button
   - Enter the **Variable Name** (e.g., `VITE_FIREBASE_API_KEY`)
   - Enter the **Value** (copy from the table above)
   - **IMPORTANT**: Check all three boxes:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
   - Click **"Save"**

4. **Verify All Variables Are Added**
   You should see 6 variables listed:
   - ✅ VITE_FIREBASE_API_KEY
   - ✅ VITE_FIREBASE_AUTH_DOMAIN
   - ✅ VITE_FIREBASE_PROJECT_ID
   - ✅ VITE_FIREBASE_STORAGE_BUCKET
   - ✅ VITE_FIREBASE_MESSAGING_SENDER_ID
   - ✅ VITE_FIREBASE_APP_ID

5. **Trigger a New Deployment**
   After setting all variables, you **MUST** redeploy:
   
   **Option A: Redeploy from Dashboard**
   - Go to **Deployments** tab
   - Find your latest deployment
   - Click **"..."** (three dots menu)
   - Click **"Redeploy"**
   - Wait for deployment to complete (2-5 minutes)

   **Option B: Push Empty Commit**
   ```bash
   git commit --allow-empty -m "Trigger rebuild with Firebase env vars"
   git push
   ```

6. **Verify It Works**
   - Wait for deployment to complete
   - Visit: https://www.reride.co.in/login
   - Open browser console (F12)
   - Look for: `✅ Firebase initialized successfully`
   - Try Google Sign-In or Phone OTP

## ⚠️ Important Notes

1. **Variable Names Must Match Exactly**
   - Must start with `VITE_` prefix
   - Case-sensitive
   - No extra spaces

2. **Enable for All Environments**
   - Make sure Production, Preview, and Development are all checked
   - This ensures it works in all deployment types

3. **Must Redeploy After Setting Variables**
   - Vite embeds environment variables at BUILD TIME
   - Old deployments don't have the new variables
   - Always trigger a new deployment after adding/updating variables

4. **Storage Bucket Format**
   - Your storage bucket uses the newer format: `.firebasestorage.app`
   - This is correct and supported by the updated validation

## 🔍 Troubleshooting

### Still seeing the error after redeploy?

1. **Check Browser Console (F12)**
   - Look for: `⚠️ Firebase Config Issue (Production)`
   - Check which variables show as invalid

2. **Verify Variables in Vercel**
   - Go back to Settings → Environment Variables
   - Click the eye icon 👁️ next to each variable
   - Verify values match exactly (no extra spaces, correct format)

3. **Check Deployment Logs**
   - Go to Deployments → Click on the deployment
   - Check build logs for any errors
   - Look for "Environment Variables" section

4. **Clear Browser Cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or use incognito/private window

## ✅ Success Indicators

When everything is working:
- ✅ No error message on login page
- ✅ Console shows: `✅ Firebase initialized successfully`
- ✅ Google Sign-In button works
- ✅ Phone OTP button works
- ✅ No warnings about missing config

---

**Quick Copy-Paste Values for Vercel:**

```
VITE_FIREBASE_API_KEY=AIzaSyDym4_piy6jakV5YAwP9pzaj_iTuNwrJK4
VITE_FIREBASE_AUTH_DOMAIN=reride-ade6a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=reride-ade6a
VITE_FIREBASE_STORAGE_BUCKET=reride-ade6a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=712465065696
VITE_FIREBASE_APP_ID=1:712465065696:web:3bd8cab935e6ad76a19285
```

Copy each line and paste into Vercel (variable name = left side, value = right side).

