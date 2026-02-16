# Troubleshooting: Data Not Fetching Even With SUPABASE_SERVICE_ROLE_KEY Set

## Quick Checklist

Since `SUPABASE_SERVICE_ROLE_KEY` is already added, check these in order:

### 1. ✅ **Redeploy Required** (Most Common Issue)
**Environment variables only take effect after redeploy!**

- Go to Vercel Dashboard → Deployments
- Find your latest deployment
- Click **⋯** → **Redeploy**
- Wait for deployment to complete (1-2 minutes)
- Refresh your admin panel

### 2. ✅ **Verify Key is Set for Production**
- Go to Vercel Dashboard → Settings → Environment Variables
- Find `SUPABASE_SERVICE_ROLE_KEY`
- Ensure it's enabled for **Production** environment (not just Preview/Development)
- The key should be 100+ characters long (JWT token format)

### 3. ✅ **Check Vercel Function Logs**
- Go to Vercel Dashboard → Your Project → Functions
- Click on `/api/users` function
- Check the logs for:
  - ✅ `SUPABASE_SERVICE_ROLE_KEY is configured` (good)
  - ❌ `SUPABASE_SERVICE_ROLE_KEY is missing` (bad - key not loaded)
  - ❌ `Failed to create Supabase admin client` (key might be invalid)
  - ❌ `RLS Policy Error` (RLS blocking even with service role key)

### 4. ✅ **Verify Key is Correct**
- Go to Supabase Dashboard → Settings → API
- Copy the **service_role** key again (not the anon key)
- Compare with what's in Vercel (you can't see the value, but verify it's not empty)
- Make sure there are no extra spaces or line breaks

### 5. ✅ **Check Database Has Data**
- Go to Supabase Dashboard → Table Editor → `users` table
- Verify users actually exist in the database
- If the table is empty, that's why you see 0 users (not a configuration issue)

### 6. ✅ **Check RLS Policies**
Even with service role key, misconfigured RLS can cause issues:
- Go to Supabase Dashboard → Authentication → Policies
- Check the `users` table policies
- Service role key should bypass RLS, but verify policies aren't blocking

### 7. ✅ **Check Browser Console**
- Open admin panel → Open DevTools (F12) → Console tab
- Look for error messages:
  - `❌ CRITICAL: Service unavailable error` → Configuration issue
  - `✅ getUsers: Successfully fetched X users` → Working correctly
  - `⚠️ getUsers: API returned 0 users` → Check database or RLS

### 8. ✅ **Check Network Tab**
- Open DevTools → Network tab
- Refresh admin panel
- Find the request to `/api/users`
- Check the response:
  - **Status 200** with array → Working (might be empty array if no users)
  - **Status 503** → Configuration error (check response body for details)
  - **Status 403** → Authentication/authorization issue

## Common Error Messages and Solutions

### Error: "SUPABASE_SERVICE_ROLE_KEY is not configured"
**Solution:** 
- Key is missing or not loaded
- **Redeploy your application** after adding the key
- Verify key is set for Production environment

### Error: "Failed to initialize Supabase admin client"
**Solution:**
- Key might be invalid or malformed
- Re-copy the service_role key from Supabase
- Ensure no extra spaces or characters
- Key should start with `eyJ...` (JWT format)

### Error: "RLS Policy Error" or "permission denied"
**Solution:**
- Even with service role key, RLS might be blocking
- Check Supabase RLS policies for `users` table
- Service role key should bypass RLS, but verify it's correct
- Try disabling RLS temporarily to test (not recommended for production)

### Error: "Database connection error"
**Solution:**
- Check `SUPABASE_URL` is set correctly in Vercel
- Verify Supabase project is active
- Check network connectivity

### Status 200 but Empty Array `[]`
**Possible Causes:**
1. **Database is actually empty** - Check Supabase dashboard
2. **RLS policies blocking** - Even with service role key (rare)
3. **Table name mismatch** - Expected `users` table
4. **Data normalization filtering** - Users might be filtered out during normalization

## Diagnostic Steps

### Step 1: Check Vercel Logs
```bash
# In Vercel Dashboard → Functions → /api/users → Logs
# Look for these messages:
✅ SUPABASE_SERVICE_ROLE_KEY is configured
✅ Supabase admin client created successfully
✅ Fetched X raw users from Supabase database
```

### Step 2: Test API Directly
```bash
# Get your access token from browser localStorage
# Then test the API:
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     https://your-domain.vercel.app/api/users

# Should return array of users or error message
```

### Step 3: Check Supabase Directly
```sql
-- In Supabase SQL Editor, run:
SELECT COUNT(*) FROM users;
SELECT email, role, status FROM users LIMIT 10;

-- If this returns 0, your database is empty
-- If this returns data, the issue is with the API/RLS
```

## Still Not Working?

If you've checked all the above and it's still not working:

1. **Share the exact error message** from:
   - Browser Console
   - Vercel Function Logs
   - Network tab response

2. **Verify these environment variables are set in Vercel:**
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for Production)

3. **Check if it works in development:**
   - If it works locally but not in production, it's an environment variable issue
   - If it doesn't work locally either, it's a code/configuration issue

4. **Try a fresh redeploy:**
   - Sometimes Vercel caches environment variables
   - Create a new deployment to force reload

## Enhanced Error Messages

The code now provides more detailed error messages:
- **Configuration errors** → Shows exactly what's wrong
- **RLS errors** → Indicates RLS policy issues
- **Connection errors** → Network/database connectivity issues
- **Empty data warnings** → Helps identify if database is empty

Check the error banner in the admin panel for specific guidance!

