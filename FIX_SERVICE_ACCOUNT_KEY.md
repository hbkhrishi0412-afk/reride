# Fix: FIREBASE_SERVICE_ACCOUNT_KEY Not Detected

## Problem
The migration script can't find `FIREBASE_SERVICE_ACCOUNT_KEY` even though it's in your file.

## Solution

The key needs to be formatted as a **single-line JSON string** in your `.env.local` file.

### Option 1: Use the Helper Script (Recommended)

1. **Save your service account JSON to a file:**
   - Copy the JSON from your `.env.local` or download it again from Firebase
   - Save it as `service-account.json` in your project root

2. **Run the formatter:**
   ```bash
   node scripts/format-service-account-key.js service-account.json
   ```

3. **Copy the output** and replace the `FIREBASE_SERVICE_ACCOUNT_KEY` line in your `.env.local`

### Option 2: Manual Formatting

Your `.env.local` should have:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"reride-ade6a","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-fbsvc@reride-ade6a.iam.gserviceaccount.com",...}'
```

**Important:**
- ✅ Must be on **one line** (no line breaks)
- ✅ Must be wrapped in **single quotes** (`'...'`)
- ✅ Newlines in `private_key` must be escaped as `\\n`
- ✅ All double quotes inside must be escaped or the whole thing wrapped in single quotes

### Option 3: Quick Fix - Use JSON File Path

If formatting is too complex, you can modify the script to read from a file instead. But the single-line format is recommended.

## Verify It Works

After fixing, run:
```bash
node scripts/migrate-firebase-to-supabase.js --dry-run
```

You should see:
```
✅ Firebase Admin SDK initialized
```

Instead of:
```
❌ FIREBASE_SERVICE_ACCOUNT_KEY is not set!
```

## Common Issues

### Issue: Multi-line JSON
**Problem:** JSON has line breaks
**Fix:** Convert to single line (use the helper script)

### Issue: Wrong Quotes
**Problem:** Using double quotes or no quotes
**Fix:** Use single quotes: `FIREBASE_SERVICE_ACCOUNT_KEY='...'`

### Issue: Escaped Characters
**Problem:** Special characters not properly escaped
**Fix:** The helper script handles this automatically

### Issue: File Not Loaded
**Problem:** `.env.local` not in the right location
**Fix:** Make sure it's in the project root (same folder as `package.json`)




