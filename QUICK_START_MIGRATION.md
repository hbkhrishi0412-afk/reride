# Quick Start: Complete Migration Setup

## ✅ What's Already Done

1. ✅ Migration script updated to use Firebase Admin SDK
2. ✅ Firebase rules updated with `serviceRequests` and `serviceProviders`
3. ✅ SQL script created for Supabase table setup
4. ✅ All code changes complete

## 📋 What You Need to Do

### Step 1: Get Firebase Service Account Key ⚠️ REQUIRED

**You need to do this manually** (I can't access your Firebase Console):

1. Go to: https://console.firebase.google.com/
2. Select your project: `reride-ade6a`
3. Click ⚙️ **Project Settings** → **Service Accounts** tab
4. Click **"Generate New Private Key"**
5. A JSON file will download

**Then add to `.env.local`:**
```bash
FIREBASE_SERVICE_ACCOUNT_KEY='<paste entire JSON content here>'
```

**Example format:**
```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"reride-ade6a","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@reride-ade6a.iam.gserviceaccount.com",...}'
```

⚠️ **Important:** Paste the ENTIRE JSON content (all of it), keep single quotes around it.

---

### Step 2: Create Supabase Table

**Copy this SQL and run it in Supabase Dashboard:**

1. Go to: https://app.supabase.com/project/pqtrsoytudolnvuydvfo/sql/new
2. Paste the SQL below
3. Click **Run**

```sql
-- Create service_requests table
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

-- Enable RLS
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
```

---

### Step 3: Run Migration

**Test first (dry-run):**
```bash
node scripts/migrate-firebase-to-supabase.js --dry-run
```

**Run actual migration:**
```bash
node scripts/migrate-firebase-to-supabase.js
```

Or:
```bash
npm run migrate:firebase-to-supabase
```

---

## 🔍 Current Status

✅ **Environment detected:**
- Supabase URL: `https://pqtrsoytudolnvuydvfo.supabase.co`
- Firebase Database: `https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/`
- Firebase Storage: `reride-ade6a.firebasestorage.app`
- `.env.local` file exists (21 variables loaded)

❌ **Missing:**
- `FIREBASE_SERVICE_ACCOUNT_KEY` (you need to add this)

---

## 📝 Files Created/Updated

1. ✅ `scripts/migrate-firebase-to-supabase.js` - Updated to use Admin SDK
2. ✅ `firebase-database-rules.json` - Added serviceRequests/serviceProviders rules
3. ✅ `scripts/create-supabase-service-requests-table.sql` - SQL script for table creation
4. ✅ `MIGRATION_FIX_SUMMARY.md` - Detailed explanation
5. ✅ `SETUP_MIGRATION_STEPS.md` - Complete setup guide
6. ✅ `QUICK_START_MIGRATION.md` - This file

---

## 🚀 After You Complete Steps 1 & 2

Once you've:
1. Added `FIREBASE_SERVICE_ACCOUNT_KEY` to `.env.local`
2. Created the Supabase table

Run the migration and you should see:
```
✅ Service Requests migration complete: X migrated, 0 skipped
```

Instead of:
```
❌ Error reading service requests from Firebase: Error: Permission denied
```

---

## 💡 Need Help?

- See `SETUP_MIGRATION_STEPS.md` for detailed instructions
- See `MIGRATION_FIX_SUMMARY.md` for technical details
- Check the error messages - they're now more helpful!


