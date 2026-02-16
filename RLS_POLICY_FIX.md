# Fix: RLS Policy "Admins can read all users" is Broken

## Problem Identified

Your RLS policy "Admins can read all users" is **not working** because:

1. **Policy checks wrong field**: The policy checks `auth.uid()` (UUID from Supabase Auth) against `users.id` (email-based key like `admin@test_com`)
2. **These never match**: `auth.uid()` returns a UUID like `123e4567-e89b-12d3-a456-426614174000`, but `users.id` is `admin@test_com`
3. **Result**: Even admin users can't read other users through RLS

## Two Solutions

### Solution 1: Use Service Role Key (RECOMMENDED) ✅

**This is the BEST solution** - Service role key bypasses RLS entirely:

1. **Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel** (see `FIX_USER_FETCH_PRODUCTION.md`)
2. **Redeploy your application**
3. **RLS policies are bypassed** - no policy fixes needed

**Why this is better:**
- ✅ Simpler - no RLS policy configuration needed
- ✅ More secure - service role key only used server-side
- ✅ Better performance - no policy evaluation overhead
- ✅ Works immediately - no policy debugging needed

### Solution 2: Fix the RLS Policy (Fallback)

If you can't use service role key, fix the policy:

1. **Go to Supabase Dashboard** → SQL Editor
2. **Run the fixed policy script**: `scripts/fix-admin-rls-policy.sql`
3. **The new policy checks email instead of UUID**:
   ```sql
   WHERE u.email = (SELECT auth.email())
   AND u.role = 'admin'
   ```

## Current Policy (BROKEN)

```sql
-- ❌ This is broken - auth.uid() is UUID, users.id is email key
CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.id = (SELECT auth.uid())::text  -- ❌ Never matches!
    AND u.role = 'admin'
  )
);
```

## Fixed Policy (OPTION 1 - Email-based)

```sql
-- ✅ This checks email instead of UUID
CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.email = (SELECT auth.email())  -- ✅ Checks email
    AND u.role = 'admin'
  )
);
```

## Fixed Policy (OPTION 2 - JWT Claims)

```sql
-- ✅ This checks JWT token role claim
CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
USING (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
);
```

## How to Apply the Fix

### If Using Service Role Key (Recommended):
1. ✅ Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel
2. ✅ Redeploy
3. ✅ Done - RLS is bypassed

### If Fixing RLS Policy:
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `scripts/fix-admin-rls-policy.sql`
3. Paste and run in SQL Editor
4. Verify policies were created:
   ```sql
   SELECT policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'users' AND policyname LIKE '%Admin%';
   ```

## Verification

After applying the fix:

1. **Check Vercel Logs**:
   - Should see: `✅ Fetched X raw users from Supabase database`
   - Should NOT see: `❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing`

2. **Check Admin Panel**:
   - Should show correct user count (9 users)
   - Users list should display all users

3. **Test RLS Policy** (if not using service role):
   - Log in as admin user
   - Try to query users table
   - Should return all users

## Why This Happened

The original policy was written assuming:
- `users.id` would be a UUID matching `auth.uid()`
- But your schema uses email-based keys (`admin@test_com`)

This mismatch causes the policy to always fail, blocking admin access.

## Recommendation

**Use Solution 1 (Service Role Key)** because:
- ✅ It's simpler and more secure
- ✅ Better performance (no RLS evaluation)
- ✅ Works immediately
- ✅ Standard practice for admin operations

Only use Solution 2 (Fix RLS Policy) if you have a specific requirement to use RLS policies instead of service role key.

