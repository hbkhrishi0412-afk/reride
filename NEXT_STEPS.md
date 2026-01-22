# Next Steps - Firebase to Supabase Migration

## 🎯 Immediate Action Items

### Step 1: Verify Supabase Environment Variables ⚠️ CRITICAL

Check your `.env.local` file (or Vercel environment variables) and ensure these are set:

#### For Local Development (.env.local):
```bash
# Client-side (React app)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Server-side (API routes)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**How to get these values:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → API
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ KEEP SECRET!)

---

### Step 2: Create Supabase Tables 📊

Before the app can work, you need to create the database tables. You have two options:

#### Option A: Run SQL Scripts (Recommended)

Go to Supabase Dashboard → SQL Editor and run these scripts in order:

1. **Users Table** (from `MIGRATION_GUIDE.md`):
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  mobile TEXT,
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

2. **Vehicles Table**:
```sql
CREATE TABLE IF NOT EXISTS vehicles (
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

3. **Conversations Table**:
```sql
CREATE TABLE IF NOT EXISTS conversations (
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

4. **Other Tables** (see `MIGRATION_GUIDE.md` for full schemas):
   - `notifications`
   - `new_cars`
   - `plans`
   - `service_providers`
   - `service_requests`

#### Option B: Let Migration Script Create Tables

The migration script can create tables automatically, but it's better to create them manually first.

---

### Step 3: Test Supabase Connection 🔌

Test that your Supabase connection works:

```bash
# If you have a test script
node test-supabase-connection.ts

# Or test via the app
npm run dev
```

Then try:
- Register a new user
- Check Supabase Dashboard → Table Editor → `users` table
- Verify the user appears in the table

---

### Step 4: Migrate Existing Data (If You Have Firebase Data) 📦

If you have existing data in Firebase that needs to be migrated:

#### First, set up Firebase Admin SDK (for migration script):

1. Get Firebase Service Account Key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Copy the entire JSON content

2. Add to `.env.local`:
```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...",...}'
```

#### Then run migration:

```bash
# Test first (dry-run - no data written)
npm run migrate:firebase-to-supabase -- --dry-run

# If dry-run looks good, run actual migration
npm run migrate:firebase-to-supabase
```

**What gets migrated:**
- ✅ Users
- ✅ Vehicles
- ✅ Conversations
- ✅ Notifications
- ✅ New Cars
- ✅ Plans
- ✅ Service Providers
- ✅ Service Requests
- ✅ Storage files (optional)

---

### Step 5: Test Critical Features 🧪

Test these features to ensure everything works:

#### User Operations:
- [ ] Register a new user
- [ ] Login with existing user
- [ ] Update user profile
- [ ] View user profile

#### Vehicle Operations:
- [ ] Create a new vehicle listing
- [ ] View vehicle list
- [ ] Update vehicle details
- [ ] Delete a vehicle
- [ ] Search/filter vehicles

#### Conversation/Messaging:
- [ ] Start a conversation
- [ ] Send messages
- [ ] View conversation history

#### Admin Operations (if admin):
- [ ] View all users
- [ ] View all vehicles
- [ ] Update user status
- [ ] Feature/unfeature vehicles

---

### Step 6: Verify Data in Supabase Dashboard 📊

1. Go to Supabase Dashboard → Table Editor
2. Check each table:
   - `users` - Should have user records
   - `vehicles` - Should have vehicle listings
   - `conversations` - Should have conversation records
   - Other tables as needed

3. Verify data looks correct:
   - Field names are snake_case
   - Data types match expectations
   - Required fields are populated

---

### Step 7: Update Production Environment (Vercel) 🚀

If deploying to production:

1. **Add Environment Variables in Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all Supabase variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`

2. **Redeploy:**
   ```bash
   # After adding env vars, trigger a new deployment
   git commit --allow-empty -m "Trigger deployment with Supabase env vars"
   git push
   ```

---

### Step 8: Configure Row Level Security (RLS) 🔒

After migration, configure RLS policies for production security:

1. Go to Supabase Dashboard → Authentication → Policies
2. Create policies for each table (examples in `MIGRATION_GUIDE.md`)

**Example for users table:**
```sql
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id);
```

**Note:** The `service_role` key bypasses RLS, so API routes will work regardless of RLS policies.

---

## 🐛 Troubleshooting

### Issue: "Supabase database is not available"
**Solution:**
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Verify service role key is correct (not anon key)
- Check Supabase project is active

### Issue: "relation 'users' does not exist"
**Solution:**
- Run Step 2 to create tables
- Check table names match exactly (case-sensitive)

### Issue: "Permission denied" errors
**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not anon key)
- Service role key bypasses RLS

### Issue: Data not appearing after migration
**Solution:**
- Check migration script output for errors
- Verify tables exist in Supabase
- Check Supabase Dashboard → Table Editor

### Issue: "Failed to create user" or similar errors
**Solution:**
- Check Supabase Dashboard → Logs for detailed errors
- Verify table schemas match the service expectations
- Check required fields are being provided

---

## ✅ Success Checklist

Before considering migration complete:

- [ ] Environment variables set (local and production)
- [ ] All Supabase tables created
- [ ] Supabase connection tested and working
- [ ] Existing data migrated (if applicable)
- [ ] User registration/login tested
- [ ] Vehicle CRUD operations tested
- [ ] Conversations/messaging tested
- [ ] Data visible in Supabase Dashboard
- [ ] Production environment variables set
- [ ] RLS policies configured (for production)

---

## 📚 Additional Resources

- `MIGRATION_GUIDE.md` - Detailed migration guide
- `SETUP_MIGRATION_STEPS.md` - Setup instructions
- `SUPABASE_SETUP_GUIDE.md` - Supabase configuration
- `MIGRATION_COMPLETE.md` - Migration summary

---

## 🆘 Need Help?

If you encounter issues:
1. Check Supabase Dashboard → Logs for error details
2. Verify environment variables are set correctly
3. Check table schemas match the service expectations
4. Review the troubleshooting section above

---

**Ready to start? Begin with Step 1!** 🚀

