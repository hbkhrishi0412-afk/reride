# Quick Start: Sync Users to Firebase

## 🚀 Quick Setup (3 Steps)

### Step 1: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. ⚙️ **Project Settings** → **Service Accounts** tab
4. Click **"Generate new private key"**
5. Save as `firebase-service-account.json` in project root

### Step 2: Set MongoDB URI

Make sure `MONGODB_URI` is in your `.env.local`:

```env
MONGODB_URI=your_mongodb_connection_string
```

### Step 3: Run Sync

```bash
node scripts/sync-users-to-firebase.js
```

## ✅ What It Does

- ✅ Fetches all users from MongoDB
- ✅ Creates Firebase Auth users
- ✅ Sets passwords for email/password users
- ✅ Sets phone numbers for phone users
- ✅ Sets custom claims (role, authProvider)
- ✅ Updates MongoDB with Firebase UIDs

## 📊 Expected Output

```
🚀 Starting User Sync to Firebase...
✅ Firebase Admin initialized
✅ Connected to MongoDB
✅ Found 25 users in database

[1/25] Processing: user@example.com (customer)
✅ Created Firebase user for user@example.com
✅ Set custom claims for user@example.com (role: customer)
✅ Updated MongoDB user with Firebase UID

📊 Sync Summary:
Total users:     25
✅ Created:       20
🔄 Updated:       5
⏭️  Existing:      0
❌ Failed:        0
```

## ⚠️ Important

- **Never commit** `firebase-service-account.json` to Git (already in .gitignore)
- Script is **idempotent** - safe to run multiple times
- Users with existing Firebase UIDs will be skipped

## 📖 Full Documentation

See `FIREBASE_USER_SYNC_GUIDE.md` for detailed instructions.






