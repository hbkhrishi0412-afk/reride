# ✅ Verify MongoDB Cluster Status

## Current Status from Your Dashboard

Based on your MongoDB Atlas dashboard:
- ✅ **Cluster Status:** Active (green dot) - **RUNNING**
- ⚠️ **Connections:** 0 (this is the problem!)
- 📊 **Region:** AWS / N. Virginia (us-east-1)
- 🔧 **Type:** Replica Set - 3 nodes

## The Issue

Your cluster is **running**, but showing **0 connections**. This means:
- The cluster itself is fine ✅
- But your application can't connect ❌

## Most Likely Causes

### 1. Network Access Not Configured (90% of cases)

**Check this first:**

1. In MongoDB Atlas, click **Network Access** (left sidebar)
2. Look at the IP Access List
3. **If empty or doesn't include `0.0.0.0/0`:**

   **Fix:**
   - Click **Add IP Address**
   - Click **Allow Access from Anywhere**
   - This adds `0.0.0.0/0` (allows all IPs)
   - Click **Confirm**
   - Wait 2-3 minutes

### 2. Environment Variable Not Set in Vercel

**Check:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Your Project → **Settings** → **Environment Variables**
3. Look for `MONGODB_URI` or `MONGODB_URL`

**If missing:**
- Get connection string from MongoDB Atlas:
  - Clusters → **Connect** → **Connect your application**
  - Copy the connection string
  - Replace `<password>` with your actual password
- Add to Vercel:
  - Click **Add New**
  - Name: `MONGODB_URI`
  - Value: Your connection string
  - ✅ Enable for Production, Preview, Development
  - Click **Save**
- **Redeploy** your application

### 3. Connection String Issues

**Get the correct connection string:**

1. MongoDB Atlas → Clusters
2. Click **Connect** button on your "Re-ride" cluster
3. Choose **Connect your application**
4. Copy the connection string
5. It should look like:
   ```
   mongodb+srv://<username>:<password>@re-ride.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with your actual password
7. Add database name: Change `/?` to `/reride?`
8. Final format:
   ```
   mongodb+srv://username:password@re-ride.xxxxx.mongodb.net/reride?retryWrites=true&w=majority
   ```

**If password has special characters, URL-encode them:**
- `@` → `%40`
- `#` → `%23`
- `/` → `%2F`
- `:` → `%3A`

## Quick Verification Steps

### Step 1: Check Network Access
```
MongoDB Atlas → Network Access
Should see: 0.0.0.0/0 (or your specific IPs)
```

### Step 2: Check Vercel Environment Variable
```
Vercel Dashboard → Settings → Environment Variables
Should see: MONGODB_URI = mongodb+srv://...
```

### Step 3: Test Connection Locally

Run this command with your production connection string:
```bash
npm run db:check-prod "mongodb+srv://username:password@re-ride.xxxxx.mongodb.net/reride"
```

Or set environment variable:
```powershell
# Windows PowerShell
$env:MONGODB_URI="mongodb+srv://username:password@re-ride.xxxxx.mongodb.net/reride"
npm run db:check-prod
```

### Step 4: Check Vercel Function Logs

1. Vercel Dashboard → Your Project
2. Click **Functions** tab
3. Look for recent invocations
4. Check for error messages

## Expected Results After Fix

Once fixed, you should see:
- ✅ Connections: > 0 (in MongoDB Atlas dashboard)
- ✅ API endpoints return 200 instead of 503
- ✅ Health check works: `https://www.reride.co.in/api/admin?action=health`

## Quick Checklist

- [ ] MongoDB Atlas → Network Access → Has `0.0.0.0/0`
- [ ] Vercel → Environment Variables → Has `MONGODB_URI`
- [ ] Connection string includes `/reride` database name
- [ ] Password is URL-encoded if it has special characters
- [ ] Cluster is RUNNING (not paused)
- [ ] Redeployed on Vercel after setting environment variable

## Still Showing 0 Connections?

1. **Wait 2-3 minutes** after changing Network Access
2. **Redeploy** on Vercel after setting environment variable
3. **Check Vercel Function Logs** for specific error messages
4. **Test connection locally** using the script above

---

**Most Common Fix:** Add `0.0.0.0/0` to MongoDB Atlas Network Access, then wait 2-3 minutes.

