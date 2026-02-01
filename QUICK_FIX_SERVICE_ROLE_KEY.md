# Quick Fix: Service Role Key Not Active

## Problem
The diagnostic shows: **"Service role may not be active (check SUPABASE_SERVICE_ROLE_KEY)"**

This is why users show as 0 in the admin panel - the service role key is not configured in production.

## Solution (5 minutes)

### Step 1: Get Your Service Role Key
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Find the **service_role** key (NOT the anon key)
5. Copy the entire key (it's 100+ characters long)

### Step 2: Add to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Set:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste the service_role key from Step 1
   - **Environment**: Select **Production** (and optionally Preview/Development)
6. Click **Save**

### Step 3: Redeploy
1. Go to **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

### Step 4: Verify
1. Open your admin panel
2. Check if users now appear (refresh if needed)
3. Check Vercel Function Logs for any errors

## Why This Happens

The service role key is required because:
- It bypasses Row Level Security (RLS) policies
- Admin operations need full database access
- Without it, queries return 0 results even if users exist

## Verification

After setting the key, you can verify it's working:

1. **Check Vercel Logs:**
   - Look for: `✅ SUPABASE_SERVICE_ROLE_KEY is configured`
   - Should NOT see: `❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing`

2. **Run Diagnostic:**
   ```bash
   node scripts/diagnose-production-supabase.js
   ```
   Should show: `✅ Service role is active (RLS bypassed)`

3. **Check Admin Panel:**
   - Users should now appear in the admin panel
   - Total Users count should be > 0

## Common Issues

### Issue: Key is set but still showing 0 users
**Solution:**
- Make sure you redeployed after adding the key
- Check that the key is set for **Production** environment
- Verify the key is correct (copy-paste again)
- Check Vercel logs for specific errors

### Issue: "Invalid key" error
**Solution:**
- Make sure you copied the **service_role** key, not the **anon** key
- The service_role key is much longer (100+ characters)
- Get it from Supabase Dashboard → Settings → API → service_role

### Issue: Key works in development but not production
**Solution:**
- Environment variables are per-environment
- Make sure the key is set for **Production** environment in Vercel
- Preview and Development environments need separate keys if you use them

## Security Note

⚠️ **IMPORTANT**: The service_role key has full database access. Never:
- Commit it to git
- Expose it in client-side code
- Share it publicly
- Use it in frontend code

It should ONLY be used in server-side API routes (which is what we're doing).

