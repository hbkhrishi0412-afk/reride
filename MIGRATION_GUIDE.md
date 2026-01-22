# Firebase to Supabase Migration Guide

This guide will help you migrate your data from Firebase Realtime Database and Firebase Storage to Supabase.

## Prerequisites

1. **Supabase Project Setup**
   - Create a Supabase project at https://supabase.com
   - Create all required tables (users, vehicles, conversations, notifications, new_cars, plans, service_providers, service_requests)
   - Set up a storage bucket named `files` in Supabase Storage

2. **Environment Variables**
   - Ensure all Firebase and Supabase environment variables are set in `.env.local`

## Migration Script Usage

### Basic Commands

```bash
# Full migration (database + storage)
npm run migrate:firebase-to-supabase

# Dry-run mode (test without writing data)
npm run migrate:firebase-to-supabase -- --dry-run

# Migrate storage files only
npm run migrate:firebase-to-supabase -- --storage-only

# Skip storage migration (database only)
npm run migrate:firebase-to-supabase -- --skip-storage
```

### Command Line Options

- `--dry-run`: Test mode - shows what would be migrated without actually writing to Supabase
- `--storage-only`: Only migrate Firebase Storage files to Supabase Storage
- `--skip-storage`: Skip storage migration, only migrate database records

## Step-by-Step Migration Process

### Step 1: Test Migration (Dry Run)

First, run a dry-run to see what will be migrated:

```bash
npm run migrate:firebase-to-supabase -- --dry-run
```

This will:
- Connect to Firebase and Supabase
- Read all data from Firebase
- Show what would be migrated
- **NOT write any data to Supabase**

### Step 2: Verify Supabase Tables

Before running the actual migration, ensure your Supabase tables have the correct structure:

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  mobile TEXT,
  password TEXT, -- Bcrypt hashed password for email/password auth. NULL for OAuth-only users.
  role TEXT DEFAULT 'customer',
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  dealership_name TEXT,
  bio TEXT,
  logo_url TEXT,
  subscription_plan TEXT DEFAULT 'free',
  featured_credits INTEGER DEFAULT 0,
  used_certifications INTEGER DEFAULT 0,
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  govt_id_verified BOOLEAN DEFAULT false,
  trust_score INTEGER,
  location TEXT,
  firebase_uid TEXT,
  auth_provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

**Note:** If you already created the users table without the password column, run this SQL to add it:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
```

#### Vehicles Table
```sql
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  category TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  variant TEXT,
  year INTEGER,
  price NUMERIC DEFAULT 0,
  mileage NUMERIC,
  images TEXT[],
  features TEXT[],
  description TEXT,
  seller_email TEXT,
  seller_name TEXT,
  engine TEXT,
  transmission TEXT,
  fuel_type TEXT,
  fuel_efficiency TEXT,
  color TEXT,
  status TEXT DEFAULT 'published',
  is_featured BOOLEAN DEFAULT false,
  views INTEGER DEFAULT 0,
  inquiries_count INTEGER DEFAULT 0,
  registration_year INTEGER,
  insurance_validity TEXT,
  insurance_type TEXT,
  rto TEXT,
  city TEXT,
  state TEXT,
  no_of_owners INTEGER,
  displacement TEXT,
  ground_clearance TEXT,
  boot_space TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  seller_id TEXT,
  vehicle_id TEXT,
  customer_name TEXT,
  seller_name TEXT,
  vehicle_name TEXT,
  vehicle_price NUMERIC,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  is_read_by_seller BOOLEAN DEFAULT false,
  is_read_by_customer BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  flagged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

#### Notifications Table
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

#### New Cars Table
```sql
CREATE TABLE new_cars (
  id TEXT PRIMARY KEY,
  brand_name TEXT,
  model_name TEXT,
  model_year INTEGER,
  price NUMERIC,
  images TEXT[],
  features TEXT[],
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

#### Plans Table
```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT,
  price NUMERIC DEFAULT 0,
  duration TEXT,
  features TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

#### Service Providers Table
```sql
CREATE TABLE service_providers (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  services TEXT[],
  rating NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

#### Service Requests Table
```sql
CREATE TABLE service_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  provider_id TEXT,
  service_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

### Step 3: Set Up Supabase Storage

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `files`
3. Set bucket to **Public** (or configure RLS policies as needed)
4. Ensure the bucket allows uploads

### Step 4: Run the Migration

Once you've verified everything with the dry-run:

```bash
npm run migrate:firebase-to-supabase
```

The script will:
1. Connect to Firebase Realtime Database
2. Connect to Firebase Storage (if configured)
3. Connect to Supabase
4. Migrate all data collections
5. Migrate storage files (if not skipped)
6. Provide a detailed summary

### Step 5: Verify Migration

1. Check Supabase Dashboard → Table Editor to verify data
2. Check Supabase Dashboard → Storage to verify files
3. Run some test queries to ensure data integrity

### Step 6: Configure Row Level Security (RLS)

After migration, configure RLS policies for production:

```sql
-- Example: Users can only read their own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = id);

-- Add more policies as needed
```

## Data Mapping

The migration script automatically maps Firebase field names to Supabase column names:

| Firebase Field | Supabase Column |
|---------------|----------------|
| `avatarUrl` | `avatar_url` |
| `logoUrl` | `logo_url` |
| `isVerified` | `is_verified` |
| `dealershipName` | `dealership_name` |
| `subscriptionPlan` | `subscription_plan` |
| `featuredCredits` | `featured_credits` |
| `usedCertifications` | `used_certifications` |
| `phoneVerified` | `phone_verified` |
| `emailVerified` | `email_verified` |
| `govtIdVerified` | `govt_id_verified` |
| `trustScore` | `trust_score` |
| `firebaseUid` | `firebase_uid` |
| `authProvider` | `auth_provider` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

Additional fields that don't have direct mappings are stored in the `metadata` JSONB column.

## Storage Migration

The script automatically:
- Detects Firebase Storage URLs in data fields
- Downloads files from Firebase Storage
- Uploads files to Supabase Storage
- Updates URLs in database records

Storage files are migrated to the `files` bucket in Supabase with the same folder structure:
- `vehicles/{vehicleId}/image_0` → `files/vehicles/{vehicleId}/image_0`
- `users/{userId}/avatar` → `files/users/{userId}/avatar`

## Troubleshooting

### Error: "Table does not exist"
- Ensure all tables are created in Supabase before running migration
- Check table names match exactly (case-sensitive)

### Error: "Permission denied"
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Service role key bypasses RLS, so this shouldn't happen unless the key is wrong

### Error: "Storage bucket not found"
- Create the `files` bucket in Supabase Storage
- Ensure the bucket is accessible

### Migration is slow
- The script processes data in batches
- Large datasets may take time
- Check your network connection and Firebase/Supabase quotas

### Some files failed to migrate
- Check Firebase Storage permissions
- Verify file URLs are accessible
- Check Supabase Storage bucket permissions

## Post-Migration Checklist

- [ ] Verify all data migrated correctly
- [ ] Check storage files are accessible
- [ ] Configure RLS policies
- [ ] Update application code to use Supabase
- [ ] Test all features with Supabase
- [ ] Update environment variables in production
- [ ] Monitor for any issues

## Rollback Plan

If you need to rollback:
1. Keep Firebase data intact (don't delete)
2. The migration uses `upsert`, so you can re-run it safely
3. To rollback, switch environment variables back to Firebase
4. Consider keeping both systems running during transition

## Support

If you encounter issues:
1. Check the migration summary for error details
2. Review Supabase logs in the dashboard
3. Verify all environment variables are set correctly
4. Run with `--dry-run` first to identify issues

