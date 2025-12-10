# 🚨 Production Database Connection Fix

## Current Issue
Your production site (`www.reride.co.in`) is showing **503 Service Unavailable** errors for API endpoints. This means the database connection is failing.

## Quick Fix Steps

### Step 1: Check Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`reride`)
3. Go to **Settings** → **Environment Variables**
4. Check if `MONGODB_URI` or `MONGODB_URL` is set

**If missing:**
- Click **Add New**
- Name: `MONGODB_URI`
- Value: Your MongoDB connection string
- Select all environments: ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### Step 2: Verify MongoDB Atlas Network Access

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your project
3. Go to **Network Access** (left sidebar)
4. Click **Add IP Address**
5. For production, you have two options:

   **Option A: Allow All IPs (Easier, less secure)**
   - Click **Allow Access from Anywhere**
   - This adds `0.0.0.0/0`
   - Click **Confirm**
   - ⚠️ Only use this for development/testing

   **Option B: Add Vercel IPs (More secure)**
   - Vercel uses dynamic IPs, so you'll need to allow all IPs or use MongoDB Atlas IP Access List
   - For production, `0.0.0.0/0` is often necessary

6. Wait 2-3 minutes for changes to propagate

### Step 3: Check MongoDB Cluster Status

1. In MongoDB Atlas, go to **Clusters**
2. Make sure your cluster is **RUNNING** (not paused)
3. Free tier clusters auto-pause after inactivity
4. If paused, click **Resume** and wait for it to start

### Step 4: Verify Connection String Format

Your connection string should look like:
```
mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority
```

**Important:**
- Replace `<password>` with your actual password
- If password has special characters, URL-encode them:
  - `@` → `%40`
  - `#` → `%23`
  - `/` → `%2F`
  - `:` → `%3A`

**Example:**
```
Password: "P@ssw0rd#123"
Encoded: "P%40ssw0rd%23123"

Connection string:
mongodb+srv://myuser:P%40ssw0rd%23123@cluster0.xxxxx.mongodb.net/reride?retryWrites=true&w=majority
```

### Step 5: Redeploy on Vercel

After setting environment variables:

1. Go to Vercel Dashboard → Your Project
2. Go to **Deployments** tab
3. Click the **⋯** (three dots) on the latest deployment
4. Click **Redeploy**
5. Or push a new commit to trigger auto-deploy

### Step 6: Test the Fix

After redeployment, test these endpoints:

```bash
# Health check
curl https://www.reride.co.in/api/admin?action=health

# Should return: {"status":"ok","database":"connected"}
```

Or visit in browser:
- `https://www.reride.co.in/api/admin?action=health`

## Troubleshooting

### Still Getting 503 Errors?

1. **Check Vercel Function Logs:**
   - Vercel Dashboard → Your Project → **Functions** tab
   - Look for error messages
   - Check the latest function invocations

2. **Verify Environment Variable Name:**
   - The code checks for `MONGODB_URL` first, then `MONGODB_URI`
   - Make sure you set the correct one (or set both)

3. **Test Connection Locally:**
   ```bash
   # Set the same connection string locally
   $env:MONGODB_URI="your_connection_string"
   
   # Test it
   npm run db:diagnose
   ```

4. **Check MongoDB Atlas Logs:**
   - MongoDB Atlas → Your Project → **Logs**
   - Look for connection attempts or errors

5. **Verify Database User:**
   - MongoDB Atlas → **Database Access**
   - Ensure your database user exists
   - Check user has "Read and write to any database" permissions

### Common Mistakes

- ❌ Forgot to URL-encode special characters in password
- ❌ Using wrong username/password
- ❌ IP address not whitelisted (most common!)
- ❌ Cluster is paused
- ❌ Environment variable not set in Vercel
- ❌ Environment variable set but not enabled for Production
- ❌ Forgot to redeploy after setting environment variable

## Quick Checklist

- [ ] `MONGODB_URI` set in Vercel Environment Variables
- [ ] Environment variable enabled for Production
- [ ] MongoDB Atlas Network Access allows `0.0.0.0/0` or Vercel IPs
- [ ] MongoDB cluster is running (not paused)
- [ ] Connection string has correct database name (`reride`)
- [ ] Special characters in password are URL-encoded
- [ ] Redeployed on Vercel after changes
- [ ] Tested `/api/admin?action=health` endpoint

## Need More Help?

Run the diagnostic tool locally with your production connection string:
```bash
$env:MONGODB_URI="your_production_connection_string"
npm run db:diagnose
```

This will tell you exactly what's wrong with the connection.

---

**Most Common Issue:** Network Access not configured in MongoDB Atlas. Make sure to add `0.0.0.0/0` to allow connections from Vercel.

