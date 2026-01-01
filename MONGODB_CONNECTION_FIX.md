# MongoDB Connection Fix Guide

## Problem
You're seeing the error: **"Login failed. Please check your connection and try again."**

This error occurs when the application cannot connect to MongoDB. The login process requires a database connection to verify user credentials.

## Quick Diagnosis

Run this command to diagnose the issue:
```bash
npm run db:diagnose
```

Or test the connection directly:
```bash
npm run db:test
```

## Common Causes & Solutions

### 1. Environment Variable Not Set

**Problem:** `MONGODB_URL` or `MONGODB_URI` is not configured.

**Solution:**
1. Create a `.env.local` file in your project root:
   ```env
   MONGODB_URI=your_connection_string_here
   ```
   
2. Or set it as an environment variable:
   - **Windows PowerShell:**
     ```powershell
     $env:MONGODB_URI="your_connection_string_here"
     ```
   - **Windows CMD:**
     ```cmd
     set MONGODB_URI=your_connection_string_here
     ```
   - **Linux/Mac:**
     ```bash
     export MONGODB_URI="your_connection_string_here"
     ```

3. **For Vercel deployment:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add `MONGODB_URI` with your connection string
   - Make sure it's enabled for Production, Preview, and Development

### 2. MongoDB Atlas Network Access

**Problem:** Your IP address is not whitelisted in MongoDB Atlas.

**Solution:**
1. Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com/)
2. Navigate to **Network Access**
3. Click **Add IP Address**
4. For development, you can add `0.0.0.0/0` to allow all IPs (not recommended for production)
5. For production, add your specific IP address or Vercel's IP ranges

### 3. Authentication Failed

**Problem:** Username or password is incorrect, or special characters need URL encoding.

**Solution:**
1. Verify your MongoDB Atlas username and password
2. If your password contains special characters, URL-encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `/` → `%2F`
   - `:` → `%3A`
   - `?` → `%3F`
   - `&` → `%26`
   - `=` → `%3D`

3. Example:
   ```
   Password: P@ssw0rd#123
   Encoded: P%40ssw0rd%23123
   ```

### 4. Cluster Not Running (Free Tier)

**Problem:** MongoDB Atlas free tier clusters auto-pause after inactivity.

**Solution:**
1. Go to MongoDB Atlas Dashboard
2. Check if your cluster is paused
3. Click **Resume** to start the cluster
4. Wait 1-2 minutes for it to fully start

### 5. Connection String Format

**Problem:** The connection string format is incorrect.

**Correct formats:**
- **MongoDB Atlas:**
  ```
  mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority
  ```
  
- **Local MongoDB:**
  ```
  mongodb://localhost:27017/reride?retryWrites=true&w=majority
  ```

**Important:** 
- The database name should be `reride`
- Include `?retryWrites=true&w=majority` for better reliability

## Step-by-Step Fix

1. **Check if environment variable is set:**
   ```bash
   # Windows PowerShell
   echo $env:MONGODB_URI
   
   # Linux/Mac
   echo $MONGODB_URI
   ```

2. **Run diagnostic:**
   ```bash
   npm run db:diagnose
   ```

3. **Test connection:**
   ```bash
   npm run db:test
   ```

4. **If connection fails, check:**
   - MongoDB Atlas cluster status (not paused)
   - Network Access settings (IP whitelisted)
   - Connection string format
   - Username/password (with URL encoding if needed)

5. **Once connected, seed the database:**
   ```bash
   node seed-database.js
   ```

## Getting Your MongoDB Connection String

### For MongoDB Atlas:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Copy the connection string
5. Replace `<password>` with your actual password (URL-encoded if needed)
6. Replace `<dbname>` with `reride`

### For Local MongoDB:

If you have MongoDB installed locally:
```
mongodb://localhost:27017/reride?retryWrites=true&w=majority
```

## Verification

After fixing the connection, verify it works:

1. **Test connection:**
   ```bash
   npm run db:test
   ```

2. **Check API health:**
   - Visit: `http://localhost:5173/api/db-health`
   - Should return: `{ "status": "connected", "database": "reride" }`

3. **Try logging in:**
   - Use the login form
   - Should no longer show "Login failed" error

## Still Having Issues?

1. Check the browser console for detailed error messages
2. Check server logs for MongoDB connection errors
3. Run `npm run db:diagnose` for detailed diagnostics
4. Verify MongoDB Atlas cluster is running and accessible
5. Check firewall settings if using local MongoDB

## Default Test Credentials

After seeding the database, you can use:
- **Admin:** `admin@test.com` / `password`
- **Seller:** `seller@test.com` / `password`
- **Customer:** `customer@test.com` / `password`















