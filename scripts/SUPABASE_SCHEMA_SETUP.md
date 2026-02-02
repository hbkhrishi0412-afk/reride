# Complete Supabase Schema Setup Guide

This guide explains how to set up the complete database schema for your ReRide website in Supabase.

## 📋 Overview

The `complete-supabase-schema.sql` file contains all the SQL code needed to create:
- ✅ All 8 database tables
- ✅ All required columns with proper data types
- ✅ Indexes for optimal query performance
- ✅ Constraints and defaults
- ✅ Auto-update triggers for `updated_at` columns
- ✅ Row Level Security (RLS) enabled
- ✅ Optional RLS policies (commented out)

## 🗂️ Tables Included

1. **users** - User accounts (customers, sellers, admins)
2. **vehicles** - Vehicle listings (used cars, bikes, etc.)
3. **conversations** - Chat conversations between users
4. **notifications** - User notifications
5. **new_cars** - New car listings
6. **plans** - Subscription plans
7. **service_providers** - Service providers (mechanics, etc.)
8. **service_requests** - Service requests

## 🚀 How to Use

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the SQL Script

1. Open the file `scripts/complete-supabase-schema.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify Tables Created

1. Go to **Table Editor** in Supabase Dashboard
2. You should see all 8 tables listed
3. Click on each table to verify columns are correct

### Step 4: Check for Errors

- If you see any errors, they will be displayed in the SQL Editor
- Common issues:
  - **Table already exists**: The script uses `IF NOT EXISTS`, so this shouldn't happen
  - **Column already exists**: The script uses `ADD COLUMN IF NOT EXISTS`, so this is safe
  - **Permission errors**: Make sure you're using the correct Supabase project

## 🔍 What the Script Does

### Safe Operations
- ✅ Uses `IF NOT EXISTS` for tables (won't break if tables already exist)
- ✅ Uses `ADD COLUMN IF NOT EXISTS` for columns (won't break if columns already exist)
- ✅ Checks before altering constraints (won't break existing data)
- ✅ Adds missing columns to existing tables

### Performance Optimizations
- ✅ Creates indexes on frequently queried columns
- ✅ Composite indexes for common query patterns
- ✅ Indexes on foreign key columns

### Data Integrity
- ✅ CHECK constraints for valid values (e.g., role must be 'customer', 'seller', or 'admin')
- ✅ NOT NULL constraints where required
- ✅ UNIQUE constraints for email addresses
- ✅ Default values for common fields

### Automation
- ✅ Auto-updates `updated_at` timestamp on row updates
- ✅ Sets `created_at` timestamp on row creation

## 📊 Table Details

### Users Table
- Stores user accounts with authentication info
- Supports email/password and OAuth (Google, Phone)
- Tracks subscription plans, credits, and verification status
- **Key columns**: `id`, `email`, `password`, `role`, `subscription_plan`

### Vehicles Table
- Stores vehicle listings
- Supports multiple categories (cars, bikes, commercial, etc.)
- Tracks views, inquiries, and featured status
- **Key columns**: `id`, `make`, `model`, `seller_email`, `status`, `is_featured`

### Conversations Table
- Stores chat conversations between customers and sellers
- Messages stored in `metadata` JSONB column
- Tracks read status for both parties
- **Key columns**: `id`, `customer_id`, `seller_id`, `vehicle_id`, `metadata`

### Notifications Table
- Stores user notifications
- Supports different notification types
- Tracks read/unread status
- **Key columns**: `id`, `user_id`, `type`, `read`

## 🔒 Row Level Security (RLS)

RLS is **enabled** on all tables but **policies are commented out** by default.

### Why?
- RLS policies depend on your authentication setup
- You may want to customize policies based on your needs
- Some applications use service role key (bypasses RLS)

### To Enable RLS Policies:
1. Uncomment the policy sections in the SQL file
2. Adjust policies based on your authentication setup
3. Test thoroughly before deploying to production

### Example Policy:
```sql
-- Allow users to read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid()::text = id);
```

## 🛠️ Troubleshooting

### Issue: "Column already exists"
**Solution**: This is safe - the script uses `IF NOT EXISTS`, so it won't create duplicates.

### Issue: "Table already exists"
**Solution**: This is safe - the script uses `IF NOT EXISTS`, so it won't recreate tables.

### Issue: "Permission denied"
**Solution**: Make sure you're running the script in the correct Supabase project with proper permissions.

### Issue: "Constraint violation"
**Solution**: Check if you have existing data that violates the new constraints. You may need to clean up data first.

### Issue: "Function already exists"
**Solution**: The `update_updated_at_column()` function is created with `CREATE OR REPLACE`, so this shouldn't happen.

## ✅ Verification

After running the script, verify:

1. **All tables exist**: Check Table Editor
2. **All columns exist**: Click on each table and verify columns
3. **Indexes created**: Go to Database → Indexes (or check via SQL)
4. **Triggers created**: Go to Database → Triggers (or check via SQL)

### Quick Verification Query:
```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users', 'vehicles', 'conversations', 'notifications',
  'new_cars', 'plans', 'service_providers', 'service_requests'
)
ORDER BY table_name;
```

## 📝 Next Steps

After running the schema:

1. **Configure RLS Policies** (if needed)
   - Uncomment and customize policies in the SQL file
   - Test with your authentication setup

2. **Set Up Storage Buckets** (if needed)
   - Go to Storage → Create Bucket
   - Create buckets for: `vehicle-images`, `user-avatars`, `documents`

3. **Test Your Application**
   - Connect your app to Supabase
   - Test CRUD operations on each table
   - Verify authentication works

4. **Run Migration** (if migrating from Firebase)
   - Use the migration script: `scripts/migrate-firebase-to-supabase.js`
   - Verify data was migrated correctly

## 🔗 Related Files

- `scripts/complete-supabase-schema-fix.sql` - Fixes for existing schema
- `scripts/migrate-firebase-to-supabase.js` - Migration script
- `MIGRATION_GUIDE.md` - Detailed migration guide

## 💡 Tips

- **Backup first**: Always backup your database before running schema changes
- **Test in staging**: Test the schema in a staging environment first
- **Monitor performance**: Check query performance after adding indexes
- **Review RLS**: Make sure RLS policies match your security requirements

## 📞 Support

If you encounter issues:
1. Check the Supabase logs in Dashboard → Logs
2. Review error messages in SQL Editor
3. Check Supabase documentation: https://supabase.com/docs

---

**Last Updated**: $(Get-Date -Format "yyyy-MM-dd")
**Schema Version**: 1.0.0










