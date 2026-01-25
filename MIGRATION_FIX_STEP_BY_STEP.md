# Firebase to Supabase Migration - Step-by-Step Fix Guide

This guide will help you fix all migration issues step by step.

## Overview

The migration has two parts:
1. **Code Migration**: ✅ Already complete (application uses Supabase)
2. **Data Migration**: ⚠️ Needs to be completed (migrate data from Firebase to Supabase)

## Step 1: Verify Current Status

First, let's check what needs to be fixed:

```bash
npm run migrate:verify
```

This will check:
- ✅ Environment variables configuration
- ✅ Supabase connection and table structure
- ✅ Firebase connection (for migration)
- ✅ Missing tables/columns

**Expected Output:**
- If everything is ready: "✅ Ready for migration!"
- If issues found: List of specific problems to fix

## Step 2: Fix Supabase Schema

If the verification shows missing tables or columns, run the comprehensive schema fix:

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open `scripts/complete-supabase-schema-fix.sql` in your editor
6. Copy the **entire contents** of the file
7. Paste into Supabase SQL Editor
8. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db execute -f scripts/complete-supabase-schema-fix.sql
```

**What this fixes:**
- ✅ Adds `password` column to `users` table
- ✅ Adds missing columns to `conversations` table (`seller_name`, `last_message`, `flagged_at`, `metadata`)
- ✅ Adds missing columns to `notifications` table (`read`, `metadata`)
- ✅ Makes `notifications.user_id` and `notifications.type` nullable
- ✅ Creates `service_providers` table if it doesn't exist
- ✅ Creates `service_requests` table if it doesn't exist
- ✅ Creates necessary indexes

## Step 3: Verify Environment Variables

Check that all required environment variables are set in `.env.local`:

### Required for Migration Script

```bash
# Firebase Admin SDK (required for reading data)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app/
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# Supabase (required for writing data)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Required for Application

```bash
# Client-side (React/Vite)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Server-side (API routes)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**How to get Firebase Service Account Key:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Copy the entire JSON content
7. Paste into `.env.local` as `FIREBASE_SERVICE_ACCOUNT_KEY='{...}'` (keep the quotes!)

**How to get Supabase Keys:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Click ⚙️ → **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## Step 4: Test Migration (Dry Run)

Before migrating actual data, test with a dry-run:

```bash
npm run migrate:firebase-to-supabase -- --dry-run
```

This will:
- ✅ Connect to Firebase and Supabase
- ✅ Read all data from Firebase
- ✅ Show what would be migrated
- ✅ **NOT write any data** to Supabase

**Review the output:**
- Check for any errors
- Verify the counts look correct
- Look for any "skipped" items (these indicate schema issues)

## Step 5: Run Actual Migration

If the dry-run looks good, run the actual migration:

```bash
npm run migrate:firebase-to-supabase
```

**Migration Options:**
- `--skip-storage`: Skip file migration (database only)
- `--storage-only`: Migrate files only (skip database)
- `--dry-run`: Test mode (no writes)

**What gets migrated:**
- ✅ Users
- ✅ Vehicles
- ✅ Conversations
- ✅ Notifications
- ✅ New Cars
- ✅ Plans
- ✅ Service Providers
- ✅ Service Requests
- ✅ Storage Files (optional)

## Step 6: Verify Migration Results

### Check Supabase Dashboard

1. Go to Supabase Dashboard → **Table Editor**
2. Verify data in each table:
   - `users` - Should have user records
   - `vehicles` - Should have vehicle listings
   - `conversations` - Should have chat conversations
   - `notifications` - Should have notification records
   - `new_cars` - Should have new car listings
   - `plans` - Should have subscription plans
   - `service_providers` - Should have service provider records
   - `service_requests` - Should have service request records

### Check Migration Summary

The migration script will output a summary like:

```
📊 Migration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Users:            10 migrated, 0 skipped
Vehicles:         25 migrated, 0 skipped
Conversations:    5 migrated, 0 skipped
Notifications:    13 migrated, 0 skipped
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Total: 53 migrated, 0 skipped
```

**If items were skipped:**
- Check the error messages
- Verify schema fixes were applied
- Re-run the schema fix SQL if needed
- Re-run the migration

## Step 7: Test Application

After migration, test your application:

1. **User Authentication**
   - Register a new user
   - Login with existing user
   - Check user profile

2. **Vehicle Operations**
   - View vehicle listings
   - Create a new vehicle listing
   - Update a vehicle
   - Delete a vehicle

3. **Conversations**
   - Send a message
   - View conversation history
   - Check notifications

4. **Admin Panel**
   - Access admin features
   - Verify data appears correctly

## Troubleshooting

### Error: "Table does not exist"

**Solution:**
1. Run `scripts/complete-supabase-schema-fix.sql` in Supabase SQL Editor
2. Verify the table was created in Supabase Dashboard
3. Re-run the migration

### Error: "Column does not exist"

**Solution:**
1. Run `scripts/complete-supabase-schema-fix.sql` in Supabase SQL Editor
2. The script uses `ADD COLUMN IF NOT EXISTS`, so it's safe to run multiple times
3. Re-run the migration

### Error: "Permission denied" (Firebase)

**Solution:**
1. Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is set correctly
2. The service account key should be valid JSON
3. Check that the key has proper permissions in Firebase Console

### Error: "Supabase connection failed"

**Solution:**
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
2. Check that the service role key is correct (not the anon key)
3. Verify your Supabase project is active

### All Items Skipped

**Solution:**
1. Check Supabase Dashboard → Table Editor to verify tables exist
2. Verify table schemas match the expected structure
3. Check that RLS policies allow service_role key to insert (service_role bypasses RLS by default)
4. Re-run the schema fix SQL

### Migration is Slow

**Solution:**
- This is normal for large datasets
- The script processes data in batches
- Check your network connection
- Monitor Firebase and Supabase quotas

## Post-Migration Checklist

- [ ] All data migrated successfully (0 skipped items)
- [ ] Verified data in Supabase Dashboard
- [ ] Tested user authentication
- [ ] Tested vehicle CRUD operations
- [ ] Tested conversations/messaging
- [ ] Tested notifications
- [ ] Configured RLS policies for production (optional)
- [ ] Updated production environment variables
- [ ] Monitored application for any issues

## Next Steps

After successful migration:

1. **Configure RLS Policies** (optional but recommended for production)
   - See commented examples in `scripts/complete-supabase-schema-fix.sql`
   - Uncomment and customize as needed

2. **Update Production Environment**
   - Set all environment variables in Vercel/your hosting platform
   - Use the same Supabase project or create a production project

3. **Monitor Application**
   - Watch for any errors
   - Check Supabase logs
   - Verify data integrity

4. **Consider Firebase Cleanup** (optional)
   - Keep Firebase data as backup initially
   - After confirming everything works, you can archive Firebase data
   - Don't delete until you're 100% confident

## Support

If you encounter issues:

1. Run `npm run migrate:verify` to check current status
2. Check the migration script output for specific error messages
3. Review Supabase Dashboard → Logs for database errors
4. Verify all environment variables are set correctly
5. Check that schema fixes were applied successfully

---

**Migration Status:** Ready to proceed
**Last Updated:** $(date)


