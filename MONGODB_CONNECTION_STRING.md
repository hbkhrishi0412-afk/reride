# ✅ MongoDB Connection String - Verified Working

## Connection String (Verified ✅)

```
mongodb+srv://hbk_hrishi0412:Qaz%403755@re-ride.69dzn4v.mongodb.net/reride?retryWrites=true&w=majority&appName=Re-ride
```

## Connection Details

- **Status:** ✅ Working
- **Database:** reride
- **Host:** re-ride.69dzn4v.mongodb.net
- **Username:** hbk_hrishi0412
- **Password:** Qaz@3755 (URL-encoded as `Qaz%403755`)
- **Collections:** 9 collections found and working

## How to Set in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `reride` project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New** (or edit existing)
5. Set:
   - **Name:** `MONGODB_URL`
   - **Value:** ``
   - ✅ Check all: **Production**, **Preview**, **Development**
6. Click **Save**
7. **Redeploy** your application

## Test Connection Locally

```bash
npm run db:check "mongodb+srv://hbk_hrishi0412:Qaz%403755@re-ride.69dzn4v.mongodb.net/reride?retryWrites=true&w=majority&appName=Re-ride"
```

## Test Production API

After updating Vercel and redeploying, test:

1. **Health Check:**
   ```
   https://www.reride.co.in/api/admin?action=health
   ```
   Should return: `{"status":"ok","database":"connected"}`

2. **Users Endpoint:**
   ```
   https://www.reride.co.in/api/users
   ```
   Should return JSON data (not 503 error)

## Current Status

- ✅ Local connection: **Working**
- ⏳ Vercel environment variable: **Needs to be set**
- ⏳ Production API: **Will work after Vercel update**

---

**Note:** The password `Qaz@3755` is URL-encoded as `Qaz%403755` in the connection string (where `%40` = `@`).

