# Supabase Update Fix for Settings and Profile

## Issue
When updating settings (Finance Partner Banks) or profile information, changes were not being saved to Supabase.

## Root Cause
The `partnerBanks` field is stored in the `metadata` JSONB column in Supabase. When updating, the code was replacing the entire `metadata` object instead of merging it with existing metadata, which could:
1. Lose other metadata fields
2. Fail to properly update nested fields like `partnerBanks`

## Fix Applied

### Updated `supabase-user-service.ts` ✅

**Changed `update()` method:**
- Now fetches existing user metadata before updating
- Merges new metadata with existing metadata instead of replacing
- Preserves all existing metadata fields when updating `partnerBanks` or other metadata fields

**Changed `updateById()` method:**
- Same fix applied for consistency

## How It Works Now

1. **Before Update**: Fetches existing user's metadata
2. **Merge Logic**: 
   - If both new and existing metadata exist → merge them
   - If only new metadata → use it
   - If only existing metadata → preserve it
3. **Update**: Saves merged metadata to Supabase

## Fields Affected

This fix ensures proper saving of:
- ✅ `partnerBanks` (Finance Partner Banks in Settings)
- ✅ `aadharCard` (Aadhar card information)
- ✅ `panCard` (PAN card information)
- ✅ `verificationStatus` (Verification status)
- ✅ `planExpiryDate` (Plan expiry dates)
- ✅ All other metadata fields

## Testing

To verify the fix works:

1. **Settings Page**:
   - Select some Finance Partner Banks
   - Click "Save Changes"
   - Refresh the page
   - Verify banks are still selected

2. **Profile Page**:
   - Update name, email, or mobile
   - Click "Save"
   - Refresh the page
   - Verify changes are persisted

3. **Password Change**:
   - Update password
   - Log out and log back in with new password
   - Verify login works

## Database Verification

Check Supabase directly:
```sql
SELECT email, metadata->>'partnerBanks' as partner_banks 
FROM users 
WHERE email = 'your-email@example.com';
```

The `partnerBanks` should be a JSON array in the metadata column.

