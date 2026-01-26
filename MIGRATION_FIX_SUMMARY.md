# Migration Fix Summary

## Issues Fixed

### 1. Firebase Permission Denied Error
**Problem:** The migration script was using Firebase Client SDK which respects security rules. The `serviceRequests` collection wasn't defined in Firebase rules, causing "Permission denied" errors.

**Solution:** 
- Updated `scripts/migrate-firebase-to-supabase.js` to use **Firebase Admin SDK** for database reads
- Admin SDK bypasses security rules, allowing the migration script to read all data
- Added `serviceRequests` and `serviceProviders` rules to `firebase-database-rules.json` as a backup

### 2. Supabase Table Missing
**Problem:** The `service_requests` table might not exist in Supabase, causing all items to be skipped.

**Solution:**
- Created `scripts/create-supabase-service-requests-table.sql` to ensure the table exists
- The SQL script creates the table with proper schema and indexes

## Changes Made

### 1. Migration Script (`scripts/migrate-firebase-to-supabase.js`)
- ✅ Replaced Firebase Client SDK imports with Firebase Admin SDK
- ✅ Updated all database read operations to use Admin SDK (`firebaseDb.ref().once('value')`)
- ✅ Updated initialization to use Admin SDK with service account credentials
- ✅ Kept Firebase Client SDK for Storage operations (simpler API)

### 2. Firebase Rules (`firebase-database-rules.json`)
- ✅ Added `serviceRequests` rules (allows authenticated read/write)
- ✅ Added `serviceProviders` rules (allows public read, authenticated write)

### 3. Supabase Setup (`scripts/create-supabase-service-requests-table.sql`)
- ✅ Created SQL script to ensure `service_requests` table exists
- ✅ Includes proper schema, indexes, and RLS setup
- ✅ Includes example RLS policies (commented out for migration)

## How to Fix Your Migration

### Step 1: Set Up Firebase Admin SDK
Make sure you have `FIREBASE_SERVICE_ACCOUNT_KEY` in your `.env.local` file:

```bash
# Get this from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...",...}'
```

### Step 2: Create Supabase Table
Run the SQL script in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `scripts/create-supabase-service-requests-table.sql`
3. Click "Run"

### Step 3: Update Firebase Rules (Optional but Recommended)
Deploy the updated Firebase rules:

1. Go to Firebase Console → Realtime Database → Rules
2. Copy the contents of `firebase-database-rules.json`
3. Paste and click "Publish"

### Step 4: Run Migration
```bash
npm run migrate:firebase-to-supabase
```

Or with dry-run first:
```bash
node scripts/migrate-firebase-to-supabase.js --dry-run
```

## Verification

After migration, verify:
1. ✅ Check Supabase Dashboard → Table Editor → `service_requests` table has data
2. ✅ Check migration output shows "Service Requests: X migrated, 0 skipped"
3. ✅ No "Permission denied" errors in the output

## Notes

- The migration script now uses Firebase Admin SDK which bypasses security rules
- The `service_role` key in Supabase also bypasses RLS, so migration should work
- After migration, configure proper RLS policies in Supabase for production use
- The Firebase rules update is optional but recommended for future client SDK usage



