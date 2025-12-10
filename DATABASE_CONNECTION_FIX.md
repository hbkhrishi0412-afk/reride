# 🔧 Database Connection Fix Guide

## Quick Diagnosis

If you're seeing the error **"Database temporarily unavailable. Please try again later."**, run this diagnostic tool:

```bash
npm run db:diagnose
```

This will check:
- ✅ Environment variables are set
- ✅ Connection string format is valid
- ✅ Database name is correct
- ✅ Actual connection works

## Common Issues & Solutions

### Issue 1: Missing Environment Variable

**Error:** `MONGODB_URL or MONGODB_URI environment variable is not defined`

**Solution:**

1. **For Local Development:**
   Create a `.env.local` file in your project root:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority
   ```
   
   Or for local MongoDB:
   ```env
   MONGODB_URI=mongodb://localhost:27017/reride
   ```

2. **For Windows PowerShell:**
   ```powershell
   $env:MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/reride"
   ```

3. **For Windows CMD:**
   ```cmd
   set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/reride
   ```

4. **For Linux/Mac:**
   ```bash
   export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/reride"
   ```

5. **For Vercel Deployment:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your project → Settings → Environment Variables
   - Add `MONGODB_URI` with your connection string
   - Make sure it's enabled for **Production**, **Preview**, and **Development**
   - Redeploy your application

### Issue 2: Authentication Failed

**Error:** `authentication failed` or `bad auth`

**Solutions:**

1. **Check Username/Password:**
   - Verify credentials in MongoDB Atlas
   - Make sure there are no extra spaces

2. **URL Encode Special Characters:**
   If your password contains special characters, encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `/` → `%2F`
   - `:` → `%3A`
   - `?` → `%3F`
   - `&` → `%26`
   - `=` → `%3D`
   - `+` → `%2B`
   - `%` → `%25`
   - ` ` (space) → `%20`

   **Example:**
   ```
   Password: "P@ssw0rd#123"
   Encoded: "P%40ssw0rd%23123"
   
   Connection string:
   mongodb+srv://username:P%40ssw0rd%23123@cluster.mongodb.net/reride
   ```

3. **Verify Database User:**
   - Go to MongoDB Atlas → Database Access
   - Ensure the user exists and has read/write permissions
   - If needed, create a new database user

### Issue 3: Network Error / Connection Timeout

**Error:** `network error`, `timeout`, `ENOTFOUND`, or `MongoServerSelectionError`

**Solutions:**

1. **Check MongoDB Atlas Network Access:**
   - Go to MongoDB Atlas → Network Access
   - Click "Add IP Address"
   - For development: Add `0.0.0.0/0` (allows all IPs - less secure but works everywhere)
   - For production: Add your specific IP addresses
   - Wait a few minutes for changes to propagate

2. **Verify Cluster Status:**
   - Go to MongoDB Atlas → Clusters
   - Make sure your cluster is **running** (not paused)
   - Free tier clusters auto-pause after inactivity - click "Resume" if needed

3. **Check Internet Connection:**
   - Verify you have internet connectivity
   - Try pinging MongoDB Atlas: `ping cluster0.xxxxx.mongodb.net`

4. **Verify Connection String Hostname:**
   - Make sure the cluster hostname in your connection string matches your actual cluster
   - Connection string format: `mongodb+srv://username:password@CLUSTER_NAME.mongodb.net/reride`

### Issue 4: Invalid Connection String Format

**Error:** `MongoDB URI must start with mongodb:// or mongodb+srv://`

**Solution:**

Ensure your connection string follows one of these formats:

**MongoDB Atlas (Cloud):**
```
mongodb+srv://username:password@cluster.mongodb.net/reride?retryWrites=true&w=majority
```

**Local MongoDB:**
```
mongodb://localhost:27017/reride
```

**With Authentication (Local):**
```
mongodb://username:password@localhost:27017/reride?authSource=admin
```

### Issue 5: Database Name Mismatch

**Error:** Connected to wrong database or database name issues

**Solution:**

The application expects the database name to be `reride`. Your connection string should include it:

```
mongodb+srv://username:password@cluster.mongodb.net/reride
                                                      ^^^^^^
```

If your connection string doesn't have a database name, the app will automatically add `/reride`.

## Step-by-Step Setup for MongoDB Atlas

1. **Create MongoDB Atlas Account:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for a free account

2. **Create a Cluster:**
   - Click "Build a Database"
   - Choose the free tier (M0)
   - Select a cloud provider and region
   - Click "Create"

3. **Create Database User:**
   - Go to Database Access → Add New Database User
   - Choose "Password" authentication
   - Username: (choose a username)
   - Password: (generate a secure password - save it!)
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

4. **Configure Network Access:**
   - Go to Network Access → Add IP Address
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add specific IP addresses
   - Click "Confirm"

5. **Get Connection String:**
   - Go to Clusters → Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `reride` (or it will be added automatically)
   - Example: `mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/reride?retryWrites=true&w=majority`

6. **Set Environment Variable:**
   - Add the connection string to your `.env.local` file or Vercel environment variables

7. **Test Connection:**
   ```bash
   npm run db:diagnose
   ```

## Testing Your Connection

### Quick Test:
```bash
npm run db:test
```

### Full Diagnostic:
```bash
npm run db:diagnose
```

### Manual Test:
```bash
node test-connection.js
```

## Still Having Issues?

1. **Check Logs:**
   - Look at your terminal/console for detailed error messages
   - Check Vercel Function Logs if deployed

2. **Verify Environment Variables:**
   ```bash
   # Windows PowerShell
   echo $env:MONGODB_URI
   
   # Linux/Mac
   echo $MONGODB_URI
   ```

3. **Test with MongoDB Compass:**
   - Download [MongoDB Compass](https://www.mongodb.com/products/compass)
   - Try connecting with your connection string
   - If Compass can't connect, the issue is with your connection string or network settings

4. **Check MongoDB Atlas Status:**
   - Visit [MongoDB Atlas Status Page](https://status.mongodb.com/)
   - Check if there are any ongoing issues

5. **Common Mistakes Checklist:**
   - ❌ Forgot to URL-encode special characters in password
   - ❌ Using wrong username/password
   - ❌ IP address not whitelisted in Network Access
   - ❌ Cluster is paused (free tier)
   - ❌ Wrong cluster hostname in connection string
   - ❌ Missing database name in connection string
   - ❌ Environment variable not set or not loaded
   - ❌ Forgot to restart dev server after setting environment variable

## Need More Help?

- **MongoDB Atlas Documentation:** https://docs.atlas.mongodb.com/
- **Connection String Guide:** https://docs.atlas.mongodb.com/getting-started/
- **MongoDB Community Forums:** https://developer.mongodb.com/community/forums/

---

**Quick Fix Summary:**
1. Run `npm run db:diagnose` to identify the issue
2. Set `MONGODB_URI` in `.env.local` (local) or Vercel (production)
3. Ensure MongoDB Atlas Network Access allows your IP
4. Verify cluster is running (not paused)
5. URL-encode special characters in password
6. Test connection again

