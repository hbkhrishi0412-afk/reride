# Fix Security and Performance Issues Guide

This guide helps you fix the security and performance issues shown in your Supabase dashboard.

## Issues to Fix

### Security Issues (4 total)
1. ✅ **Function `update_buyer_activity_updated_at`** - Fixed with search_path
2. ✅ **Function `update_services_updated_at`** - Fixed with search_path  
3. ✅ **Function `update_updated_at_column`** - Fixed with search_path
4. ⚠️ **Supabase Auth compromised passwords** - Requires manual Dashboard configuration

### Performance Issues (8 total)
- Slow queries (0.34s - 2.24s) - Fixed with additional indexes

## How to Fix

### Step 1: Run the Fix Script

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy and paste the contents of `fix-security-and-performance-issues.sql`
4. Click **Run** to execute the script

This script will:
- ✅ Fix all 3 database function security issues
- ✅ Add performance indexes for faster queries
- ✅ Optimize query planner statistics

### Step 2: Enable Compromised Password Prevention (Manual)

The script cannot automatically enable this feature. You need to do it manually:

1. Go to **Supabase Dashboard**
2. Navigate to **Authentication** → **Policies**
3. Find **"Prevent use of compromised passwords"**
4. **Enable** this option

This feature uses the Have I Been Pwned API to check if passwords have been compromised in data breaches.

## What the Fixes Do

### Security Fixes

**Function Search Path Security:**
- Sets `search_path = public, pg_temp` on all trigger functions
- Prevents SQL injection attacks through schema manipulation
- Required by Supabase security best practices

**Compromised Password Prevention:**
- Checks passwords against Have I Been Pwned database
- Prevents users from using passwords that have been leaked in data breaches
- Improves overall account security

### Performance Fixes

**New Indexes Added:**
- `services`: Indexes on `created_at` and `updated_at` for sorting
- `buyer_activity`: Composite index on `user_id, updated_at` for user queries
- `vehicles`: Composite indexes for status and seller queries
- `service_requests`: Multiple indexes for filtering and sorting
- `conversations`: Indexes for customer/seller queries

**Query Optimization:**
- Runs `ANALYZE` on all tables to update query planner statistics
- Helps PostgreSQL choose better query execution plans

## Verification

After running the script, check:

1. **Security Tab**: Should show 0 issues (after enabling compromised passwords)
2. **Performance Tab**: Should show fewer or no slow queries
3. **Query Performance**: Queries should be faster (< 100ms for most operations)

## Troubleshooting

### If functions still show security issues:
- Make sure you ran the complete fix script
- Check that the functions exist in your database
- Verify the search_path is set: `SELECT proname, proconfig FROM pg_proc WHERE proname LIKE '%updated_at%';`

### If queries are still slow:
- Check if indexes were created: `SELECT * FROM pg_indexes WHERE schemaname = 'public';`
- Run `ANALYZE` on specific tables if needed
- Check the query execution plan in Supabase dashboard

### If compromised password option is not available:
- This feature may not be available in all Supabase plans
- Check your Supabase project settings
- Contact Supabase support if needed

## Files Modified

- ✅ `scripts/fix-security-and-performance-issues.sql` - Main fix script
- ✅ `scripts/create-services-table.sql` - Updated function security
- ✅ `scripts/add-buyer-activity-table.sql` - Updated function security
- ✅ `scripts/complete-supabase-schema.sql` - Updated function security

## Next Steps

1. Run the fix script in Supabase SQL Editor
2. Enable compromised password prevention in Dashboard
3. Monitor the Security and Performance tabs for improvements
4. Test your application to ensure everything works correctly


