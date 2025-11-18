# Vehicle Migration and Debugging Guide

This guide helps you migrate vehicles from local storage to production and debug issues with your production database.

## Issues Fixed

1. ✅ **Email Case Sensitivity**: Fixed frontend filter to use case-insensitive comparison
2. ✅ **API Email Normalization**: API now normalizes `sellerEmail` to lowercase when returning vehicles
3. ✅ **Expired Listings for Premium Plans**: Premium plans with no expiry date won't have their listings auto-unpublished

## Tools Created

### 1. Migration Tool (`migrate-vehicles-to-production.html`)

Use this tool to migrate vehicles from localStorage to your production database.

**How to use:**
1. Open `migrate-vehicles-to-production.html` in your browser (while on your local development environment)
2. Enter your seller email (e.g., `seller@test.com`)
3. Optionally enter your production API URL (or leave empty to use current domain)
4. Click "Load Vehicles from localStorage" to see your local vehicles
5. Review the statistics
6. Click "Migrate Vehicles to Production" to upload them to the database
7. Use "Fix Expired Listings" button if you have Premium plan and want to remove expiry dates

**Features:**
- Shows statistics about vehicles to migrate
- Handles duplicate vehicles (skips if already exists)
- Normalizes email addresses automatically
- Removes expiry dates for Premium plans
- Provides detailed logs of the migration process

### 2. Debug Tool (`debug-production-database.html`)

Use this tool to analyze and fix issues in your production database.

**How to use:**
1. Open `debug-production-database.html` in your browser (on production or local)
2. Enter your seller email
3. Optionally enter your production API URL
4. Click "Analyze Database" to see:
   - Total vehicles count
   - Status breakdown (published/unpublished/sold)
   - Expired listings count
   - Email mismatches
   - Missing fields
5. Review the issues found
6. Use "Auto-Fix Issues" to automatically fix:
   - Email case mismatches
   - Expired listings (for Premium plans)
   - Missing expiry dates

**Features:**
- Detailed statistics dashboard
- Issue detection and reporting
- Vehicle table with all details
- One-click fix for individual vehicles
- Auto-fix all issues at once

## Common Issues and Solutions

### Issue 1: Vehicles Not Showing After Deployment

**Symptoms:**
- See 61 vehicles locally but only 1 in production

**Causes:**
1. Vehicles only exist in localStorage, not in MongoDB
2. Email case mismatch between database and frontend filter
3. Vehicles have expired `listingExpiresAt` dates

**Solutions:**
1. Use the Migration Tool to upload vehicles from localStorage to production
2. The code fixes now handle email case sensitivity automatically
3. Use the Debug Tool to find and fix expired listings

### Issue 2: Email Case Sensitivity

**Symptoms:**
- Vehicles exist in database but don't show in dashboard
- Different case in `sellerEmail` field

**Solution:**
- ✅ Fixed in code: Frontend now uses case-insensitive comparison
- ✅ Fixed in code: API normalizes emails to lowercase
- Use Debug Tool to fix existing vehicles with wrong case

### Issue 3: Expired Listings for Premium Plans

**Symptoms:**
- Premium plan vehicles are being auto-unpublished
- Vehicles have `listingExpiresAt` dates that have passed

**Solution:**
- ✅ Fixed in code: Premium plans without expiry won't auto-unpublish
- Use Debug Tool's "Auto-Fix Issues" to remove expiry dates from Premium plan vehicles

## Step-by-Step Migration Process

1. **Backup First** (Optional but recommended)
   - Export your local vehicles: Open browser console and run:
     ```javascript
     JSON.stringify(JSON.parse(localStorage.getItem('reRideVehicles') || '[]'), null, 2)
     ```
   - Save the output to a file

2. **Use Migration Tool**
   - Open `migrate-vehicles-to-production.html`
   - Enter your seller email
   - Enter production URL (e.g., `https://your-app.vercel.app`)
   - Load and migrate vehicles

3. **Verify with Debug Tool**
   - Open `debug-production-database.html`
   - Enter your seller email and production URL
   - Analyze database to verify all vehicles are there
   - Fix any issues found

4. **Test in Production**
   - Log in to your production dashboard
   - Verify all vehicles are showing correctly

## Code Changes Made

### `App.tsx`
- Fixed email filter to use case-insensitive comparison:
  ```typescript
  vehicles.filter(v => 
    v.sellerEmail?.toLowerCase().trim() === currentUser.email?.toLowerCase().trim()
  )
  ```

### `api/main.ts`
- Normalizes `sellerEmail` when returning vehicles
- Fixed Premium plan expiry logic to prevent auto-unpublishing

## Troubleshooting

### Migration Fails with "Seller not found"
- Ensure your seller account exists in production database
- Check that the email matches exactly (case-insensitive)

### Some Vehicles Still Missing
- Check the Debug Tool for email mismatches
- Verify vehicles aren't marked as "sold" or have other status issues
- Check browser console for errors

### Rate Limiting Errors
- The migration tool includes delays between requests
- If you still get rate limited, wait a few minutes and retry

## Support

If you encounter issues:
1. Check browser console for errors
2. Use Debug Tool to analyze the database state
3. Review the logs in both tools for detailed error messages

