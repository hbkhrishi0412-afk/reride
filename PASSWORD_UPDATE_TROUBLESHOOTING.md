# Password Update Troubleshooting Guide

This guide helps you diagnose and fix password update issues by checking Firebase connection, user permissions, network connectivity, and server logs.

## Table of Contents
1. [Check Firebase Connection](#1-check-firebase-connection)
2. [Verify User Permissions](#2-verify-user-permissions)
3. [Check Network Connectivity](#3-check-network-connectivity)
4. [Check Server Logs (Vercel)](#4-check-server-logs-vercel)
5. [Quick Diagnostic Script](#5-quick-diagnostic-script)

---

## 1. Check Firebase Connection

### Method A: Using the Health Check Endpoint (Recommended)

**In Browser:**
1. Open your browser's Developer Console (F12)
2. Navigate to your deployed app (e.g., `https://your-app.vercel.app`)
3. Run this in the console:
```javascript
fetch('/api/db-health')
  .then(res => res.json())
  .then(data => {
    console.log('Firebase Status:', data);
    if (data.status === 'ok') {
      console.log('✅ Firebase is connected!');
    } else {
      console.error('❌ Firebase connection failed:', data.message);
    }
  })
  .catch(err => console.error('❌ Error checking Firebase:', err));
```

**Using cURL (Terminal/PowerShell):**
```bash
# Replace with your app URL
curl https://your-app.vercel.app/api/db-health
```

**Expected Success Response:**
```json
{
  "status": "ok",
  "message": "Firebase connected successfully.",
  "database": "Firebase Realtime Database",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**If Connection Fails:**
- Check Firebase environment variables in Vercel
- Verify Firebase service account credentials
- Ensure Firebase Realtime Database is enabled

### Method B: Check Firebase Environment Variables

**In Vercel Dashboard:**
1. Go to your project: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Verify these variables are set:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_SERVICE_ACCOUNT` (for server-side operations)

**Check Locally (Development):**
1. Check your `.env.local` file (or `.env` file)
2. Ensure all `FIREBASE_*` variables are set
3. For server-side, use `FIREBASE_*` (not `VITE_FIREBASE_*`)

### Method C: Test Firebase Connection Directly

**Using the Test Connection Endpoint:**
```javascript
fetch('/api/system?action=test-connection')
  .then(res => res.json())
  .then(data => console.log('Connection Test:', data))
  .catch(err => console.error('Error:', err));
```

---

## 2. Verify User Permissions

### Check if User Can Update Their Own Profile

**Test in Browser Console:**
```javascript
// First, get your current user token
const token = localStorage.getItem('reRideAccessToken');
const email = 'your-email@example.com'; // Replace with your email

// Test password update API call
fetch('/api/users', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    email: email,
    // Don't actually change password, just test
    name: 'Test User' // Test with a safe field first
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('✅ User has permission to update profile');
  } else {
    console.error('❌ Permission denied:', data.reason);
  }
})
.catch(err => console.error('❌ Error:', err));
```

### Check Authentication Token

**Verify Token is Valid:**
```javascript
const token = localStorage.getItem('reRideAccessToken');
if (!token) {
  console.error('❌ No access token found. Please log in again.');
} else {
  console.log('✅ Access token found:', token.substring(0, 20) + '...');
  
  // Decode token (basic check - not full validation)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token payload:', {
      email: payload.email,
      role: payload.role,
      exp: new Date(payload.exp * 1000).toISOString()
    });
  } catch (e) {
    console.error('❌ Invalid token format');
  }
}
```

### Check User Role and Status

**Verify User Data:**
```javascript
const currentUser = JSON.parse(localStorage.getItem('reRideCurrentUser') || '{}');
console.log('Current User:', {
  email: currentUser.email,
  role: currentUser.role,
  status: currentUser.status,
  firebaseUid: currentUser.firebaseUid ? 'Present' : 'Missing'
});

if (currentUser.status === 'inactive') {
  console.error('❌ User account is inactive');
}
if (!currentUser.role) {
  console.error('❌ User role is missing');
}
```

---

## 3. Check Network Connectivity

### Test API Endpoint Availability

**Check if API is Reachable:**
```javascript
// Test basic connectivity
fetch('/api/db-health', { 
  method: 'GET',
  signal: AbortSignal.timeout(5000) // 5 second timeout
})
.then(res => {
  console.log('✅ API is reachable. Status:', res.status);
  return res.json();
})
.then(data => console.log('Response:', data))
.catch(err => {
  if (err.name === 'TimeoutError') {
    console.error('❌ Request timed out - network issue');
  } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
    console.error('❌ Network error - cannot reach server');
  } else {
    console.error('❌ Error:', err);
  }
});
```

### Check CORS and Network Errors

**In Browser Network Tab:**
1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Try to change password
4. Look for the `PUT /api/users` request
5. Check:
   - **Status Code**: Should be 200 (success) or 401/403 (auth error)
   - **Response**: Check the error message in response body
   - **Headers**: Verify `Authorization` header is present

**Common Network Issues:**
- **CORS Error**: Check if API allows your domain
- **Timeout**: Server might be slow or unreachable
- **502/503**: Server is down or overloaded
- **504**: Gateway timeout - server took too long

### Test from Different Network

If possible, test from:
- Different WiFi network
- Mobile data connection
- Different location

This helps identify if it's a network-specific issue.

---

## 4. Check Server Logs (Vercel)

### Access Vercel Logs

**Method 1: Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click on **Deployments** tab
4. Click on the latest deployment
5. Click on **Functions** tab
6. Look for `/api/users` function
7. Check **Logs** section for errors

**Method 2: Vercel CLI**
```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# View logs
vercel logs --follow
```

**Method 3: Real-time Logs in Dashboard**
1. Go to your project in Vercel
2. Click **Deployments** → Latest deployment
3. Click **Functions** → `/api/users`
4. Click **View Function Logs**
5. Filter by timestamp when you tried to change password

### What to Look For in Logs

**Search for these error patterns:**
```
❌ Database error during user update
❌ Error finding user
❌ Error fetching updated user
❌ Error hashing password
⚠️ Error syncing Firebase Auth profile
```

**Example Log Entry to Find:**
```
[timestamp] 🔄 PUT /users - Updating user: { email: 'user@example.com', hasPassword: true }
[timestamp] 💾 Updating user in Firebase...
[timestamp] ❌ Database error during user update: [error message]
```

### Check Firebase Admin Initialization

**Look for:**
```
✅ Firebase Admin initialized successfully
❌ Firebase Admin is not initialized
❌ Failed to initialize Firebase Admin
```

**If Firebase Admin is not initialized:**
- Check `FIREBASE_SERVICE_ACCOUNT` environment variable
- Verify service account JSON is valid
- Ensure no syntax errors in JSON

---

## 5. Quick Diagnostic Script

Create a file `test-password-update.html` in your `public` folder:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Password Update Diagnostic</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .test { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .pass { background: #d4edda; }
        .fail { background: #f8d7da; }
        .info { background: #d1ecf1; }
    </style>
</head>
<body>
    <h1>Password Update Diagnostic Tool</h1>
    <div id="results"></div>
    
    <script>
        const results = document.getElementById('results');
        
        function addResult(name, passed, message) {
            const div = document.createElement('div');
            div.className = `test ${passed ? 'pass' : 'fail'}`;
            div.innerHTML = `<strong>${name}:</strong> ${passed ? '✅' : '❌'} ${message}`;
            results.appendChild(div);
        }
        
        async function runDiagnostics() {
            // Test 1: Firebase Connection
            try {
                const healthRes = await fetch('/api/db-health');
                const healthData = await healthRes.json();
                addResult('Firebase Connection', healthData.status === 'ok', 
                    healthData.status === 'ok' ? 'Connected' : healthData.message);
            } catch (err) {
                addResult('Firebase Connection', false, err.message);
            }
            
            // Test 2: Authentication Token
            const token = localStorage.getItem('reRideAccessToken');
            addResult('Authentication Token', !!token, 
                token ? 'Token found' : 'No token - please log in');
            
            // Test 3: Current User
            const currentUser = JSON.parse(localStorage.getItem('reRideCurrentUser') || '{}');
            addResult('Current User', !!currentUser.email, 
                currentUser.email || 'No user data');
            
            // Test 4: API Reachability
            try {
                const testRes = await fetch('/api/db-health', { 
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });
                addResult('API Reachability', testRes.ok, 
                    `Status: ${testRes.status}`);
            } catch (err) {
                addResult('API Reachability', false, 
                    err.name === 'TimeoutError' ? 'Timeout' : err.message);
            }
            
            // Test 5: Permission Check (if authenticated)
            if (token && currentUser.email) {
                try {
                    const permRes = await fetch('/api/users', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            email: currentUser.email,
                            name: currentUser.name // Safe test field
                        })
                    });
                    const permData = await permRes.json();
                    addResult('Update Permission', permRes.ok && permData.success, 
                        permData.reason || 'Can update profile');
                } catch (err) {
                    addResult('Update Permission', false, err.message);
                }
            }
        }
        
        runDiagnostics();
    </script>
</body>
</html>
```

**Usage:**
1. Save the file to `public/test-password-update.html`
2. Navigate to `https://your-app.vercel.app/test-password-update.html`
3. Review the diagnostic results

---

## Common Issues and Solutions

### Issue: "Server error" when updating password

**Possible Causes:**
1. Firebase connection failed
2. User not found in database
3. Permission denied
4. Password hashing failed
5. Network timeout

**Solution:**
1. Check Firebase connection (Step 1)
2. Verify user exists in Firebase
3. Check authentication token is valid
4. Review server logs for specific error

### Issue: "Authentication expired"

**Solution:**
1. Log out and log in again
2. Check token expiration in browser console
3. Verify token refresh is working

### Issue: "User not found"

**Solution:**
1. Verify user email matches exactly (case-sensitive)
2. Check if user exists in Firebase database
3. Ensure user was created properly

### Issue: "Permission denied"

**Solution:**
1. Verify you're updating your own profile (not another user's)
2. Check user role is correct
3. Ensure user status is 'active'

---

## Getting Help

If issues persist after checking all the above:

1. **Collect Information:**
   - Screenshot of browser console errors
   - Vercel function logs (from Step 4)
   - Response from `/api/db-health` endpoint
   - Network tab showing the failed request

2. **Check Error Messages:**
   - Look for specific error messages in server logs
   - Note the exact timestamp when error occurred
   - Check if error is consistent or intermittent

3. **Verify Environment:**
   - All Firebase environment variables are set
   - Service account JSON is valid
   - Firebase Realtime Database is enabled
   - Database rules allow updates

---

## Quick Checklist

Before reporting an issue, verify:

- [ ] Firebase health check returns `status: "ok"`
- [ ] Authentication token exists and is valid
- [ ] User can update non-password fields (e.g., name)
- [ ] Network requests are reaching the server (check Network tab)
- [ ] Server logs show specific error (not just "Server error")
- [ ] All Firebase environment variables are set in Vercel
- [ ] User account status is "active"
- [ ] User is trying to update their own profile

---

**Last Updated:** 2024-01-01







