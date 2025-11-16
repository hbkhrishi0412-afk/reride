# Quick Database Fix Guide

## 🚀 Quick Start

### Step 1: Verify Current Database State
```bash
npm run db:verify
```

This will show you:
- Which collections exist
- Which collections are missing
- What indexes are configured
- Any database name mismatches

### Step 2: Fix Missing Collections
```bash
npm run db:setup
```

This will:
- Create any missing collections
- Set up all required indexes
- Ensure your database structure is correct

## 📋 What Was Fixed

1. **Database Name Normalization**
   - Code now automatically handles "Re-ride", "re-ride", "reride" variations
   - Ensures consistent connection to `reride` database

2. **Conversations Model**
   - Created `models/Conversation.ts` for MongoDB persistence
   - Includes proper indexes for efficient queries

3. **Verification Tools**
   - `npm run db:verify` - Check database structure
   - `npm run db:setup` - Create missing collections

## ⚠️ Important Notes

- **Database Name**: Ensure your MongoDB database is named `reride` (lowercase, no hyphen)
- **Connection String**: Your `MONGODB_URI` should include the database name:
  ```
  mongodb+srv://user:pass@cluster.mongodb.net/reride
  ```

## 🔍 Expected Collections

Your `reride` database should have these 5 collections:
1. `users`
2. `vehicles`
3. `vehicledatas`
4. `newcars`
5. `conversations`

## ❓ Troubleshooting

**Scripts don't run?**
- Set `MONGODB_URI` environment variable first
- Check your MongoDB connection string is correct

**Collections still missing?**
- Run `npm run db:setup` again
- Check MongoDB Atlas network access settings
- Verify database user has read/write permissions

**Database name issues?**
- The code now auto-normalizes, but verify in MongoDB Atlas
- Database should be named `reride` (not "Re-ride")

