# Complete Migration Setup Steps

## Step 1: Set Up Firebase Admin SDK

### Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. A JSON file will download - **DO NOT commit this file to git!**

### Add to .env.local

Open your `.env.local` file (create it if it doesn't exist) and add:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='<paste the entire JSON content here>'
```

**Important:** 
- Paste the ENTIRE JSON content (all of it, not just parts)
- Keep the single quotes around it
- The JSON should start with `{"type":"service_account","project_id":"...",...}`

Example:
```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"my-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

## Step 2: Create Supabase Table

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the SQL below:

```sql
-- Create service_requests table in Supabase if it doesn't exist
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  provider_id TEXT,
  service_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Enable RLS (Row Level Security)
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
```

6. Click **Run** (or press Ctrl+Enter)

### Option B: Using Supabase CLI

If you have Supabase CLI installed:
```bash
supabase db execute -f scripts/create-supabase-service-requests-table.sql
```

## Step 3: Verify Environment Variables

Make sure these are set in your `.env.local`:

```bash
# Firebase (for Admin SDK)
FIREBASE_SERVICE_ACCOUNT_KEY='...'  # Required for migration

# Firebase (for Client SDK - if needed)
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_DATABASE_URL=...

# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...  # Required for migration
```

## Step 4: Run Migration

### Test with Dry-Run First (Recommended)
```bash
node scripts/migrate-firebase-to-supabase.js --dry-run
```

This will show you what would be migrated without actually writing to Supabase.

### Run Full Migration
```bash
npm run migrate:firebase-to-supabase
```

Or:
```bash
node scripts/migrate-firebase-to-supabase.js
```

## Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT_KEY is not set"
- Make sure `.env.local` exists in the project root
- Verify the variable name is exactly `FIREBASE_SERVICE_ACCOUNT_KEY`
- Check that the JSON is properly quoted

### Error: "Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON"
- Make sure you pasted the ENTIRE JSON file content
- Check for any extra quotes or escaping issues
- The JSON should be a single line or properly escaped

### Error: "Permission denied" (shouldn't happen with Admin SDK)
- Verify you're using the updated migration script
- Check that Firebase Admin SDK is properly initialized
- Ensure the service account has proper permissions

### Error: "relation 'service_requests' does not exist"
- Run Step 2 to create the Supabase table
- Verify you're connected to the correct Supabase project

### All items skipped
- Check that Supabase table exists and has correct schema
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check Supabase dashboard for any errors

## Verification

After migration completes successfully:

1. ✅ Check Supabase Dashboard → Table Editor → `service_requests`
2. ✅ Verify data appears in the table
3. ✅ Check migration output shows: "Service Requests: X migrated, 0 skipped"
4. ✅ No "Permission denied" errors in the output

## Next Steps After Migration

1. Configure RLS policies in Supabase for production use
2. Update your application code to use Supabase instead of Firebase
3. Test the migrated data in your application
4. Consider setting up proper RLS policies (see commented examples in SQL script)




