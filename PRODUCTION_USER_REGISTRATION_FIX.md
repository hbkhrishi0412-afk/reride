# Production User Registration Fix

## Problem
User details are not getting added to Supabase in production.

## Root Causes Identified

### 1. Missing `SUPABASE_SERVICE_ROLE_KEY` (Most Likely)
- **Issue**: The API uses `getSupabaseAdminClient()` which requires `SUPABASE_SERVICE_ROLE_KEY`
- **Impact**: If this key is not set in Vercel production environment, user creation will fail
- **Error**: "SUPABASE_SERVICE_ROLE_KEY is required for admin operations"

### 2. Row Level Security (RLS) Policies
- **Issue**: If RLS is enabled on the `users` table and there's no INSERT policy, inserts will be blocked
- **Impact**: Even with correct credentials, user creation fails with "permission denied" errors
- **Error**: "new row violates row-level security policy"

### 3. Insufficient Error Logging
- **Issue**: Errors were not providing enough context to diagnose the problem
- **Impact**: Difficult to identify the exact cause of failures in production

## Fixes Applied

### 1. Enhanced Error Handling in `services/supabase-user-service.ts`
- Added specific error handling for missing `SUPABASE_SERVICE_ROLE_KEY`
- Enhanced error messages for RLS policy errors
- Added detailed error logging with context (error codes, hints, etc.)
- Better error messages for duplicate keys and constraint violations

### 2. Improved Error Messages in `api/main.ts`
- Added specific error handling for service role key issues
- Enhanced RLS policy error messages with actionable guidance
- Better error logging in non-production environments
- More descriptive error responses for production

### 3. SQL Script for INSERT Policy
- Created `scripts/fix-users-insert-policy.sql`
- Provides options for adding INSERT policies if needed
- Includes troubleshooting guide
- Documents when policies are needed vs when service role key bypasses RLS

### 4. Diagnostic Script
- Created `scripts/diagnose-production-supabase.js`
- Checks all required environment variables
- Tests Supabase connection
- Provides actionable recommendations
- Identifies critical configuration issues

## How to Fix in Production

### Step 1: Check Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these variables are set for **Production** environment:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` - **CRITICAL** - Your Supabase service role key

3. If `SUPABASE_SERVICE_ROLE_KEY` is missing:
   - Go to Supabase Dashboard → Settings → API
   - Copy the "service_role" key (keep it secret!)
   - Add it to Vercel environment variables
   - Make sure it's set for "Production" environment

4. **Redeploy** your application after adding/updating variables

### Step 2: Check RLS Policies (If Service Role Key is Not Set)

If you cannot use `SUPABASE_SERVICE_ROLE_KEY` for some reason:

1. Go to Supabase Dashboard → Authentication → Policies
2. Check if RLS is enabled on the `users` table
3. If RLS is enabled, you need an INSERT policy
4. Run the SQL script: `scripts/fix-users-insert-policy.sql`
5. Or manually add an INSERT policy in Supabase SQL Editor

**Note**: Using `SUPABASE_SERVICE_ROLE_KEY` is the recommended approach as it bypasses RLS and is more secure for API operations.

### Step 3: Run Diagnostic Script

Run the diagnostic script to verify your configuration:

```bash
node scripts/diagnose-production-supabase.js
```

This will:
- Check all environment variables
- Test Supabase connection
- Identify any configuration issues
- Provide specific recommendations

### Step 4: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment → View Function Logs
3. Look for errors containing:
   - "SUPABASE_SERVICE_ROLE_KEY"
   - "permission denied"
   - "row-level security"
   - "RLS Policy"

The enhanced error messages will now provide more context about what's failing.

## Testing

After applying fixes:

1. Try registering a new user
2. Check Vercel function logs for any errors
3. Verify the user appears in Supabase Dashboard → Table Editor → users table
4. If still failing, check the specific error message in logs

## Common Error Messages and Solutions

### Error: "SUPABASE_SERVICE_ROLE_KEY is not configured"
**Solution**: Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables

### Error: "RLS Policy Error" or "permission denied"
**Solution**: Either:
- Set `SUPABASE_SERVICE_ROLE_KEY` (recommended), OR
- Add an INSERT policy to the users table (see `scripts/fix-users-insert-policy.sql`)

### Error: "User with this email already exists"
**Solution**: This is expected - the user already exists. Try a different email.

### Error: "Failed to create user: [database error]"
**Solution**: Check the full error message in logs. It will now include more details about the specific database error.

## Prevention

To prevent this issue in the future:

1. **Always set `SUPABASE_SERVICE_ROLE_KEY` in production** - This is required for server-side operations
2. **Use the diagnostic script** before deploying to production
3. **Check Vercel logs** after deployment to catch configuration issues early
4. **Test user registration** in production after each deployment

## Files Modified

- `services/supabase-user-service.ts` - Enhanced error handling
- `api/main.ts` - Improved error messages and logging
- `scripts/fix-users-insert-policy.sql` - SQL script for INSERT policies (new)
- `scripts/diagnose-production-supabase.js` - Diagnostic script (new)

## Additional Notes

- The service role key **bypasses RLS policies**, so if it's set correctly, you don't need INSERT policies
- The service role key should **never** be exposed in client-side code
- Always use `SUPABASE_SERVICE_ROLE_KEY` for server-side API operations
- Use `VITE_SUPABASE_ANON_KEY` for client-side operations only

## Why Users Show as Zero in Admin Panel

If users are showing as 0 in the admin panel even after fixing registration:

### Root Cause
The admin panel fetches users via `/api/users` which calls `userService.findAll()`. This method uses `getSupabaseAdminClient()` which requires `SUPABASE_SERVICE_ROLE_KEY`. If this key is missing or misconfigured:

1. The admin client cannot be created
2. The query fails or returns 0 users
3. Even if users exist in the database, they won't be visible

### Solution

1. **Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set for **Production** environment
   - The key should be 100+ characters long
   - Get it from Supabase Dashboard → Settings → API → service_role key

2. **Redeploy after setting the key:**
   - Environment variables require a redeploy to take effect
   - Go to Vercel Dashboard → Deployments → Redeploy

3. **Check Vercel Function Logs:**
   - Look for errors containing "SUPABASE_SERVICE_ROLE_KEY"
   - Look for "permission denied" or "row-level security" errors
   - The enhanced error messages will now provide specific guidance

4. **Run Diagnostic Script:**
   ```bash
   node scripts/diagnose-production-supabase.js
   ```

5. **Check SELECT Policies (if needed):**
   - Run `scripts/check-users-select-policy.sql` in Supabase SQL Editor
   - This will show if RLS is blocking SELECT access
   - Service role key should bypass RLS, but verify it's configured correctly

### Enhanced Error Handling

The `findAll()` method now includes:
- Early detection of missing `SUPABASE_SERVICE_ROLE_KEY`
- Specific error messages for RLS policy errors
- Detailed logging to help diagnose issues
- Warnings when 0 users are returned

Check Vercel function logs for these enhanced error messages to identify the exact issue.

