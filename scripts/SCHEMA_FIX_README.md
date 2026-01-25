# Supabase Schema Fix Migration

This document explains the schema fixes applied to resolve migration issues.

## Issues Found During Migration

During the Firebase to Supabase migration, the following schema issues were encountered:

1. **Conversations Table**: Missing `flagged_at` column
   - Error: `Could not find the 'flagged_at' column of 'conversations' in the schema cache`
   - Impact: 5 conversations were skipped

2. **Notifications Table**: Missing `metadata` column
   - Error: `Could not find the 'metadata' column of 'notifications' in the schema cache`
   - Impact: 13 notifications were skipped

3. **Service Providers Table**: Table doesn't exist
   - Error: `Could not find the table 'public.service_providers' in the schema cache`
   - Impact: 2 service providers were skipped

## Solution

### 1. SQL Migration File

Created `scripts/fix-supabase-schema-migration.sql` which:
- Adds the missing `flagged_at` column to `conversations` table
- Adds the missing `metadata` column to `notifications` table
- Creates the `service_providers` table with all required columns
- Adds indexes for better query performance
- Includes optional RLS policies (commented out)

### 2. Migration Script Improvements

Updated `scripts/migrate-firebase-to-supabase.js` to:
- Handle missing columns gracefully with fallback logic
- Retry inserts without problematic fields if column errors occur
- Provide helpful error messages suggesting to run the schema migration
- Better error detection for column/table missing errors

## How to Apply the Fix

### Step 1: Run the Schema Migration

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `scripts/fix-supabase-schema-migration.sql`
4. Run the SQL script

### Step 2: Re-run the Migration

After applying the schema fixes, re-run the migration script:

```bash
node scripts/migrate-firebase-to-supabase.js --skip-storage
```

The migration script will now:
- Successfully migrate all conversations (including flagged_at data)
- Successfully migrate all notifications (including metadata)
- Successfully migrate all service providers

## Expected Results

After applying the fixes and re-running the migration:

- ✅ All 5 conversations should migrate successfully
- ✅ All 13 notifications should migrate successfully  
- ✅ All 2 service providers should migrate successfully

**Total expected**: 60 + 20 = 80 items migrated (previously 60 migrated, 20 skipped)

## Verification

After migration, verify in Supabase Dashboard:

1. **Conversations Table**: Check that all 5 conversations are present with `flagged_at` column
2. **Notifications Table**: Check that all 13 notifications are present with `metadata` column
3. **Service Providers Table**: Check that all 2 service providers are present

## Notes

- The migration script now has fallback logic, so it will attempt to insert data even if some columns are missing
- However, it's recommended to run the schema migration first to ensure all data is properly migrated
- The `metadata` column in notifications stores all additional notification fields that don't have dedicated columns
- The `flagged_at` column in conversations stores when a conversation was flagged (if applicable)


