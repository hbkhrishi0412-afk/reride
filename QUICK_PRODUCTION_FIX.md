# 🚨 QUICK FIX: Production 503 Errors

## Immediate Steps (5 minutes)

### 1. Check Vercel Environment Variables ⚡

1. Go to: https://vercel.com/dashboard
2. Select your `reride` project
3. Click **Settings** → **Environment Variables**
4. Look for `MONGODB_URI` or `MONGODB_URL`

**If it's missing or wrong:**
- Click **Add New** or **Edit**
- Name: `MONGODB_URI`
- Value: Your MongoDB connection string
- ✅ Check all: Production, Preview, Development
- Click **Save**

### 2. Fix MongoDB Atlas Network Access ⚡

1. Go to: https://cloud.mongodb.com/
2. Select your project
3. Click **Network Access** (left sidebar)
4. Click **Add IP Address**
5. Click **Allow Access from Anywhere** (adds `0.0.0.0/0`)
6. Click **Confirm**
7. Wait 2-3 minutes

### 3. Check Cluster is Running ⚡

1. In MongoDB Atlas, click **Clusters**
2. Make sure cluster shows **RUNNING** (not paused)
3. If paused, click **Resume** and wait

### 4. Redeploy on Vercel ⚡

1. Vercel Dashboard → Your Project
2. Click **Deployments** tab
3. Click **⋯** on latest deployment
4. Click **Redeploy**

### 5. Test ⚡

Visit: https://www.reride.co.in/api/admin?action=health

Should return: `{"status":"ok","database":"connected"}`

---

## Your MongoDB Connection String Format

Should look like:
```
mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority
```

**Get it from MongoDB Atlas:**
1. Clusters → Connect → Connect your application
2. Copy the connection string
3. Replace `<password>` with your actual password
4. If password has special characters, URL-encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `/` → `%2F`

---

## Still Not Working?

Check Vercel Function Logs:
1. Vercel Dashboard → Your Project → **Functions** tab
2. Look for error messages
3. Check the latest invocations

Most common issue: **Network Access not configured** - make sure `0.0.0.0/0` is added in MongoDB Atlas!

