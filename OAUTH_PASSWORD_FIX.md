# OAuth User Password Login Fix

## Problem
OAuth users (Google/Phone sign-in) were unable to log in with email/password because:
1. The Supabase `users` table was missing the `password` column
2. The login logic rejected OAuth users who didn't have a password set

## Solution
The fix allows OAuth users to set a password during login, enabling them to use email/password authentication in the future.

### Changes Made

1. **Added Password Column to Supabase Schema**
   - Created SQL script: `scripts/add-password-column-to-users.sql`
   - Updated `MIGRATION_GUIDE.md` to include password column in schema

2. **Updated Supabase User Service**
   - Modified `services/supabase-user-service.ts` to handle password field:
     - `supabaseRowToUser()` now extracts password from database
     - `userToSupabaseRow()` now includes password when saving

3. **Updated Login Logic**
   - Modified `api/main.ts` login handler:
     - If OAuth user doesn't have a password but provides one during login, it will be hashed and saved
     - User can then use email/password login in the future

## Next Steps

### 1. Add Password Column to Supabase Database

Run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password TEXT;
```

Or use the provided script:
```bash
# Copy the SQL from scripts/add-password-column-to-users.sql
# and run it in Supabase SQL Editor
```

### 2. Test the Fix

1. **For existing OAuth users:**
   - Try logging in with email/password
   - The system will automatically set the password on first login
   - Future logins will work with email/password

2. **For new users:**
   - OAuth users can continue using OAuth
   - They can optionally set a password during email/password login attempt
   - Email/password users work as before

## How It Works

1. User attempts email/password login
2. System checks if user exists and has a password
3. **If no password exists (OAuth user):**
   - System hashes the provided password
   - Saves it to the database
   - Proceeds with login
4. **If password exists:**
   - System verifies the password
   - Proceeds with login if valid

## Security Notes

- Passwords are always hashed using bcrypt before storage
- OAuth users retain their original `authProvider` value
- Password is optional - OAuth users can still use OAuth login
- The password field is never returned in API responses

## Files Modified

- `services/supabase-user-service.ts` - Added password field handling
- `api/main.ts` - Updated login logic to allow password setting for OAuth users
- `MIGRATION_GUIDE.md` - Updated schema documentation
- `scripts/add-password-column-to-users.sql` - SQL script to add password column

