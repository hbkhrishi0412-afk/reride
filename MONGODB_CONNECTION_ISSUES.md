# MongoDB Connection Issues - Diagnosis Report

## 🔍 Issues Identified

### 1. **Missing Environment Variable Configuration**
- ❌ No `.env` file exists in the project
- ❌ `MONGODB_URI` environment variable is not set
- ⚠️ Code expects `process.env.MONGODB_URI` but it's undefined

**Files Affected:**
- `lib/db.ts` (line 32-34): Throws error if MONGODB_URI is not defined
- `api/system.ts` (line 53): Checks for MONGODB_URI
- `api/main.ts` (line 160): Error handling for missing MONGODB_URI

### 2. **Inconsistent MongoDB Client Implementation**
Multiple different MongoDB connection approaches are used:

#### A. Mongoose (lib/db.ts)
```typescript
// Uses mongoose with caching
await mongoose.connect(process.env.MONGODB_URI, opts)
```

#### B. Native MongoDB Driver (api/sell-car/index.ts)
```typescript
// Uses MongoClient with fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(MONGODB_URI);
```

#### C. Hardcoded Credentials (dev-api-server-mongodb.js)
```javascript
// Hardcoded connection string - SECURITY ISSUE!
const MONGODB_URI = 'mongodb+srv://hbk_hrishi0412:Qaz%403755@cluster0.nmiwnl7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
```

### 3. **Development Server Not Using MongoDB**
- 🚨 **Critical Issue**: The active dev server (`dev-api-server.js`) uses **mock data only**
- There's a MongoDB-enabled server (`dev-api-server-mongodb.js`) but it's **not being used**
- `package.json` script: `"dev:api": "node dev-api-server.js"` → Uses mock data

### 4. **Security Issue: Exposed Credentials**
The file `dev-api-server-mongodb.js` contains:
- Username: `hbk_hrishi0412`
- Password: `Qaz@3755` (URL-encoded as `Qaz%403755`)
- Cluster: `cluster0.nmiwnl7.mongodb.net`

⚠️ **These credentials are committed to version control!**

### 5. **Connection String Configuration Issues**
- Password contains `@` symbol → Must be URL-encoded as `%40` ✅ (Already done)
- Missing database name in connection string → Uses `?dbName=reride` parameter ✅
- IPv6 issues handled with `family: 4` option ✅

## 🛠️ Solutions

### Solution 1: Create .env File
Create a `.env` file in the project root:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://hbk_hrishi0412:Qaz%403755@cluster0.nmiwnl7.mongodb.net/reride?retryWrites=true&w=majority&appName=Cluster0

# Optional
DB_NAME=reride
NODE_ENV=development
```

### Solution 2: Update .gitignore
Add to `.gitignore` to prevent committing credentials:

```
.env
.env.local
.env.*.local
```

### Solution 3: Use MongoDB Dev Server
Update `package.json` to use the MongoDB-enabled server:

```json
{
  "scripts": {
    "dev:api": "node dev-api-server-mongodb.js",
    "dev:api:mock": "node dev-api-server.js"
  }
}
```

### Solution 4: Remove Hardcoded Credentials
Update `dev-api-server-mongodb.js` to use environment variables:

```javascript
// Before (INSECURE):
const MONGODB_URI = 'mongodb+srv://hbk_hrishi0412:...';

// After (SECURE):
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reride';
```

### Solution 5: Standardize MongoDB Client
Choose ONE MongoDB connection approach across the entire app:
- **Recommended**: Use `lib/db.ts` (mongoose) for all connections
- Benefits: Connection pooling, schema validation, better error handling

### Solution 6: Environment-Specific Configuration

**For Development:**
```bash
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/reride"
node dev-api-server-mongodb.js
```

**For Production (Vercel):**
Add environment variable in Vercel Dashboard:
- Key: `MONGODB_URI`
- Value: `mongodb+srv://user:pass@cluster.mongodb.net/reride`

## 🔧 Quick Fix Commands

### Step 1: Create .env file
```bash
cat > .env << 'EOF'
MONGODB_URI=mongodb+srv://hbk_hrishi0412:Qaz%403755@cluster0.nmiwnl7.mongodb.net/reride?retryWrites=true&w=majority&appName=Cluster0
DB_NAME=reride
NODE_ENV=development
EOF
```

### Step 2: Update dev server to read from .env
```bash
npm install dotenv
```

### Step 3: Test MongoDB connection
```bash
node test-mongodb-data.js
```

### Step 4: Switch to MongoDB dev server
```bash
npm run dev  # Will now use MongoDB instead of mock data
```

## 📋 Verification Checklist

- [ ] `.env` file created with MONGODB_URI
- [ ] `.gitignore` updated to exclude .env files
- [ ] Hardcoded credentials removed from dev-api-server-mongodb.js
- [ ] Dev server switched to MongoDB-enabled version
- [ ] MongoDB connection tested successfully
- [ ] All API endpoints return real data from MongoDB
- [ ] Vercel environment variables configured (for production)

## 🔗 Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>/<database>?<options>

Example:
mongodb+srv://user:pass%40word@cluster0.abc123.mongodb.net/reride?retryWrites=true&w=majority
```

**Important Notes:**
- Special characters in password must be URL-encoded:
  - `@` → `%40`
  - `:` → `%3A`
  - `/` → `%2F`
  - `?` → `%3F`
  - `#` → `%23`
  - `%` → `%25`

## 🎯 Root Cause Analysis

The application has **dual-mode** operation but lacks proper environment configuration:

1. **Mock Mode** (Current Default)
   - Uses `dev-api-server.js`
   - No database connection
   - Data doesn't persist

2. **Database Mode** (Not Configured)
   - Uses `dev-api-server-mongodb.js`
   - Requires MONGODB_URI
   - Data persists to MongoDB Atlas

**The issue**: No `.env` file means `MONGODB_URI` is undefined, causing connection failures.

## 🚀 Recommended Action Plan

1. **Immediate** (5 minutes):
   - Create `.env` file with MongoDB credentials
   - Update `.gitignore` to exclude `.env`

2. **Short-term** (15 minutes):
   - Remove hardcoded credentials from dev-api-server-mongodb.js
   - Switch default dev server to MongoDB version
   - Test all API endpoints

3. **Long-term** (1 hour):
   - Standardize on single MongoDB client (mongoose via lib/db.ts)
   - Add connection retry logic
   - Implement health check endpoints
   - Add comprehensive error handling
   - Rotate compromised credentials in MongoDB Atlas

## 📊 Current State Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Environment Variables | ❌ Missing | No .env file |
| MongoDB Connection | ❌ Failed | MONGODB_URI undefined |
| Dev Server | ⚠️ Wrong Mode | Using mock data instead of MongoDB |
| Credentials Security | ❌ Exposed | Hardcoded in source code |
| Client Implementation | ⚠️ Inconsistent | 3 different approaches |
| Production (Vercel) | ❓ Unknown | Depends on env vars |

## 🔐 Security Recommendations

1. **Immediately**: Rotate MongoDB credentials (they're exposed in git history)
2. Remove hardcoded credentials from all files
3. Use environment variables exclusively
4. Add `.env` to `.gitignore`
5. Enable MongoDB Atlas IP whitelist
6. Use separate credentials for dev/staging/production
7. Implement connection encryption (already using `mongodb+srv://`)

---

**Report Generated**: 2025-11-10
**Issue Severity**: HIGH (Connection failure + Security exposure)
**Estimated Fix Time**: 30 minutes
