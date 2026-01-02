# 🛠️ Local Development Setup Guide

## Quick Start

To fix the "Firebase Database Connection Issue" in local development, you need to create a `.env.local` file with your Firebase credentials.

## Step 1: Get Firebase Credentials

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project (or create a new one)

2. **Get Web App Configuration**
   - Click the gear icon ⚙️ next to "Project Overview"
   - Select **"Project settings"**
   - Scroll down to **"Your apps"** section
   - If you don't have a web app, click **"Add app"** → **"Web"** (</> icon)
   - Copy the configuration values

3. **Get Database URL**
   - In Firebase Console, go to **"Realtime Database"** (or **"Firestore Database"**)
   - If you haven't created a database, click **"Create Database"**
   - Choose your region (e.g., `asia-southeast1`)
   - Copy the database URL (format: `https://your-project-default-rtdb.region.firebasedatabase.app/`)
   - ⚠️ **Important**: Include the trailing slash `/` at the end

## Step 2: Create `.env.local` File

1. **Copy the example file:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Or create manually:**
   Create a file named `.env.local` in the project root directory

3. **Add your Firebase credentials:**
   ```env
   # Client-side Firebase variables (VITE_ prefix is required)
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app/

   # Server-side Firebase variables (same values or separate)
   FIREBASE_API_KEY=AIzaSy...
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=123456789012
   FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   FIREBASE_DATABASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app/

   # JWT Secret (generate using: node scripts/generate-jwt-secret.js)
   JWT_SECRET=your_jwt_secret_here
   ```

## Step 3: Generate JWT Secret (Optional but Recommended)

```bash
node scripts/generate-jwt-secret.js
```

Copy the generated secret and add it to `.env.local` as `JWT_SECRET`.

## Step 4: Restart Development Server

**Important**: After creating or updating `.env.local`, you MUST restart the development server:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 5: Verify Setup

1. **Check browser console** (F12)
   - Look for: `🔍 Firebase Config Debug (Dev):`
   - Verify all values show as valid (not "MISSING")

2. **Check for errors**
   - The "Firebase Database Connection Issue" banner should disappear
   - No Firebase-related errors in console

## 🔍 Troubleshooting

### Issue: Variables still showing as MISSING after restart

**Solutions:**
1. **Verify file location**: `.env.local` must be in the project root (same directory as `package.json`)
2. **Check variable names**: Must start with `VITE_` for client-side variables
3. **No spaces**: Don't add spaces around `=` sign
4. **No quotes needed**: Don't wrap values in quotes unless they contain special characters
5. **Restart server**: Always restart after changing `.env.local`

### Issue: Database URL format error

**Correct format:**
```
https://your-project-default-rtdb.region.firebasedatabase.app/
```
- Must start with `https://`
- Must include trailing slash `/`
- Must contain `firebasedatabase` in the URL

### Issue: "Invalid API key" error

**Solutions:**
1. Verify you copied the entire API key (starts with `AIzaSy`)
2. Check for extra spaces or line breaks
3. Ensure you're using the Web app API key (not iOS/Android)

### Issue: Variables work in production but not locally

**Remember:**
- **Local development** uses `.env.local` file
- **Production** uses Vercel Environment Variables
- They are **separate** - you need to set both!

## 📋 Required Variables Checklist

For local development, ensure these are set in `.env.local`:

- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] `VITE_FIREBASE_PROJECT_ID`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `VITE_FIREBASE_APP_ID`
- [ ] `VITE_FIREBASE_DATABASE_URL` ⚠️ **CRITICAL**
- [ ] `FIREBASE_DATABASE_URL` (for API routes)
- [ ] `JWT_SECRET`

## 🚀 Next Steps

Once Firebase is configured:

1. **Test the connection:**
   - Open browser console
   - Look for Firebase initialization messages
   - Try using features that require Firebase (login, database operations)

2. **Optional: Set up Firebase Emulators**
   - If you want to test locally without connecting to production Firebase
   - See `firebase.json` for emulator configuration
   - Run: `firebase emulators:start`

## 💡 Pro Tips

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Use `.env.local.example`** as a template for team members
3. **Restart server** after every `.env.local` change
4. **Check console** for Firebase debug info in development mode
5. **Verify database URL** includes trailing slash

## 📞 Still Having Issues?

1. Check browser console for specific error messages
2. Verify Firebase project is active in Firebase Console
3. Ensure Realtime Database is enabled (not just Firestore)
4. Check network tab for failed Firebase requests
5. Review `FIREBASE_PRODUCTION_DEBUGGING_GUIDE.md` for more detailed troubleshooting


