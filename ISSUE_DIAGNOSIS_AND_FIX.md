# Vehicle Loading and Login Issues - Diagnosis and Fix

## 🔍 Issues Identified

### 1. **Vehicle Loading Issue**
**Symptoms:**
- Vehicles not loading on the website
- Empty vehicle list displayed
- No error messages shown to user

**Root Causes:**
1. **API Server Not Running**: The API server must be running on port 3001 for development
2. **Firebase Connection Issues**: Firebase may not be properly configured or connected
3. **Empty Database**: No vehicles in the database
4. **Network/CORS Issues**: API requests failing due to network or CORS problems

### 2. **Login "Invalid Credentials" Issue**
**Symptoms:**
- Login shows "Invalid credentials" even with correct password
- User cannot log in

**Root Causes:**
1. **User Not in Database**: User doesn't exist in Firebase database
2. **Email Normalization Mismatch**: Email case sensitivity issues
3. **Password Hash Mismatch**: Password hashing/verification failing
4. **Supabase Auth Issues**: Supabase authentication failing
5. **Firebase Connection Issues**: Cannot access user data from Firebase

## 🛠️ Solutions

### Step 1: Run Diagnostic Script

First, run the diagnostic script to identify the exact issue:

```bash
node scripts/diagnose-issues.js
```

This will check:
- ✅ API server status
- ✅ Environment variables
- ✅ Login endpoint
- ✅ Database connectivity

### Step 2: Start API Server (If Not Running)

The API server must be running for the website to work:

```bash
# In a separate terminal
npm run dev:api
```

The API server should start on `http://localhost:3001`

### Step 3: Check Environment Variables

Ensure all required environment variables are set in `.env.local`:

**Client-side (VITE_*):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Server-side:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key
```

### Step 4: Verify Database Has Data

**Check if vehicles exist:**
1. Open Firebase Console
2. Navigate to your database
3. Check the `vehicles` collection
4. Ensure there are vehicles with `status: "published"`

**Check if users exist:**
1. Navigate to the `users` collection
2. Verify your user account exists
3. Check that email is stored in lowercase

### Step 5: Clear Browser Cache and LocalStorage

Sometimes cached data causes issues:

1. Open browser DevTools (F12)
2. Go to Application tab → Storage → Clear site data
3. Or manually clear:
   - `localStorage.removeItem('reRideVehicles_prod')`
   - `localStorage.removeItem('reRideCurrentUser')`
   - `localStorage.removeItem('reRideAccessToken')`

### Step 6: Test Login with Test Users

The system auto-creates test users in development mode:

**Test Credentials:**
- **Admin**: `admin@test.com` / `password`
- **Seller**: `seller@test.com` / `password`
- **Customer**: `customer@test.com` / `password`

**Note**: These only work in non-production environments.

### Step 7: Check Browser Console

Open browser DevTools (F12) and check:

1. **Console Tab**: Look for error messages
   - Red errors indicate failures
   - Check for "API request timeout" or "Network error"

2. **Network Tab**: Check API requests
   - Look for failed requests (red status codes)
   - Check if `/api/vehicles` returns 200 OK
   - Check if `/api/users` returns proper responses

## 🔧 Common Fixes

### Fix 1: API Server Connection Error

**Error**: `API Proxy Error: connect ECONNREFUSED`

**Solution**:
```bash
# Start the API server
npm run dev:api

# In another terminal, start the frontend
npm run dev
```

### Fix 2: No Vehicles Loading

**Error**: Vehicles array is empty

**Solutions**:
1. **Check Firebase connection**:
   ```bash
   # Verify Firebase credentials in .env.local
   # Test Firebase connection
   ```

2. **Seed the database**:
   - Use the admin panel to add vehicles
   - Or use the API to create test vehicles

3. **Check vehicle status**:
   - Only vehicles with `status: "published"` are shown
   - Unpublished or sold vehicles won't appear

### Fix 3: Login "Invalid Credentials"

**Error**: Login fails with "Invalid credentials"

**Solutions**:

1. **Check if user exists**:
   - Verify user email in Firebase database
   - Ensure email is stored in lowercase

2. **Try test users** (development only):
   - `admin@test.com` / `password`
   - `seller@test.com` / `password`
   - `customer@test.com` / `password`

3. **Register a new account**:
   - If user doesn't exist, register first
   - Then try logging in

4. **Check email normalization**:
   - The system normalizes emails to lowercase
   - Try logging in with lowercase email

5. **Reset password** (if feature exists):
   - Use password reset functionality
   - Or contact admin to reset password

### Fix 4: Supabase Auth Issues

**Error**: Supabase authentication failing

**Solutions**:
1. **Verify Supabase credentials**:
   - Check `.env.local` has correct Supabase URL and keys
   - Ensure keys are not expired

2. **Check Supabase project status**:
   - Verify project is active in Supabase dashboard
   - Check if project has been paused

3. **Fallback to API login**:
   - The system falls back to API login if Supabase fails
   - Check if API login works

## 📋 Troubleshooting Checklist

- [ ] API server is running (`npm run dev:api`)
- [ ] Frontend dev server is running (`npm run dev`)
- [ ] Environment variables are set in `.env.local`
- [ ] Firebase credentials are correct
- [ ] Supabase credentials are correct
- [ ] Database has vehicles with `status: "published"`
- [ ] User exists in database
- [ ] Browser cache/localStorage cleared
- [ ] No errors in browser console
- [ ] Network requests are successful (200 OK)

## 🚀 Quick Start Guide

1. **Start API server**:
   ```bash
   npm run dev:api
   ```

2. **Start frontend** (in another terminal):
   ```bash
   npm run dev
   ```

3. **Run diagnostics**:
   ```bash
   node scripts/diagnose-issues.js
   ```

4. **Open browser**:
   - Go to `http://localhost:5173`
   - Open DevTools (F12)
   - Check Console and Network tabs

5. **Test login**:
   - Try test credentials: `seller@test.com` / `password`
   - Or register a new account

## 📞 Still Having Issues?

If problems persist:

1. **Check logs**:
   - API server console logs
   - Browser console errors
   - Network request failures

2. **Verify configuration**:
   - Run `node scripts/verify-supabase-config.js`
   - Check environment variables

3. **Test endpoints directly**:
   ```bash
   # Test vehicles endpoint
   curl http://localhost:3001/api/vehicles

   # Test login endpoint
   curl -X POST http://localhost:3001/api/users \
     -H "Content-Type: application/json" \
     -d '{"action":"login","email":"seller@test.com","password":"password","role":"seller"}'
   ```

4. **Check database**:
   - Verify Firebase connection
   - Check if data exists
   - Verify data structure matches expected format

---

**Last Updated**: $(Get-Date -Format "yyyy-MM-dd")



