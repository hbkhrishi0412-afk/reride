# 🔥 Firebase Setup - Complete Step-by-Step Guide

This guide will walk you through setting up Firebase for your ReRide application from scratch to production deployment.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Install Firebase CLI](#step-1-install-firebase-cli)
3. [Step 2: Create Firebase Project](#step-2-create-firebase-project)
4. [Step 3: Register Web App in Firebase](#step-3-register-web-app-in-firebase)
5. [Step 4: Get Firebase Configuration](#step-4-get-firebase-configuration)
6. [Step 5: Configure Environment Variables (Local)](#step-5-configure-environment-variables-local)
7. [Step 6: Enable Authentication Methods](#step-6-enable-authentication-methods)
8. [Step 7: Configure Firebase for Production (Vercel)](#step-7-configure-firebase-for-production-vercel)
9. [Step 8: Initialize Firebase in Your Project](#step-8-initialize-firebase-in-your-project)
10. [Step 9: Verify Firebase Setup](#step-9-verify-firebase-setup)
11. [Optional: Firebase Hosting Setup](#optional-firebase-hosting-setup)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:
- ✅ A Google account
- ✅ Node.js installed (v18 or higher)
- ✅ npm or yarn package manager
- ✅ Your project dependencies installed (`npm install`)

---

## Step 1: Install Firebase CLI

The Firebase CLI allows you to manage Firebase projects from the command line.

### Install globally:
```bash
npm install -g firebase-tools
```

### Verify installation:
```bash
firebase --version
```

You should see the version number (e.g., `13.0.0` or higher).

---

## Step 2: Create Firebase Project

1. **Go to Firebase Console**
   - Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click **"Add project"** or **"Create a project"**
   - Enter project name (e.g., `reride-app`)
   - Click **"Continue"**

3. **Configure Google Analytics** (Optional)
   - Choose whether to enable Google Analytics
   - If enabled, select or create an Analytics account
   - Click **"Continue"**

4. **Complete Project Creation**
   - Click **"Create project"**
   - Wait for project creation to complete (30-60 seconds)
   - Click **"Continue"** when ready

---

## Step 3: Register Web App in Firebase

1. **Open Project Settings**
   - In Firebase Console, click the **⚙️ gear icon** next to "Project Overview"
   - Select **"Project settings"**

2. **Add Web App**
   - Scroll down to **"Your apps"** section
   - Click the **web icon** `</>` (or **"Add app"** → **"Web"**)

3. **Register Your App**
   - Enter an app nickname (e.g., `reride-web`)
   - **Optional**: Check "Also set up Firebase Hosting" (we'll do this separately if needed)
   - Click **"Register app"**

4. **Copy Configuration**
   - You'll see your Firebase configuration object
   - **Keep this page open** - you'll need these values in the next step

---

## Step 4: Get Firebase Configuration

Your Firebase configuration should look like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

**Copy all 6 values** - you'll need them for environment variables.

---

## Step 5: Configure Environment Variables (Local)

### For Local Development:

1. **Create `.env.local` file** in your project root directory (same folder as `package.json`)

2. **Add Firebase Configuration Variables**

   Create the file with this template:

   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
   ```

3. **Replace Placeholder Values**
   - Replace `your_api_key_here` with your actual API key from Step 4
   - Replace `your-project-id` with your actual project ID
   - Replace all other placeholder values with your actual Firebase config values

   **Example:**
   ```env
   VITE_FIREBASE_API_KEY=AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz
   VITE_FIREBASE_AUTH_DOMAIN=reride-app-12345.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=reride-app-12345
   VITE_FIREBASE_STORAGE_BUCKET=reride-app-12345.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=987654321098
   VITE_FIREBASE_APP_ID=1:987654321098:web:abcdef1234567890abcdef
   ```

4. **Important Notes:**
   - ⚠️ **Do NOT commit `.env.local` to Git** (it should be in `.gitignore`)
   - ✅ All variable names must start with `VITE_` prefix (required by Vite)
   - ✅ No spaces around the `=` sign
   - ✅ No quotes needed around values

5. **Restart Development Server**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```
   
   Environment variables are only loaded when the server starts!

---

## Step 6: Enable Authentication Methods

1. **Navigate to Authentication**
   - In Firebase Console, click **"Authentication"** in the left sidebar
   - Click **"Get started"** (if this is your first time)

2. **Enable Sign-In Methods**

   Go to the **"Sign-in method"** tab and enable the methods you need:

   **For Email/Password Authentication:**
   - Click on **"Email/Password"**
   - Toggle **"Enable"** to ON
   - Click **"Save"**

   **For Google Sign-In:**
   - Click on **"Google"**
   - Toggle **"Enable"** to ON
   - Enter your support email (e.g., `support@reride.com`)
   - Click **"Save"**

   **For Phone Authentication:**
   - Click on **"Phone"**
   - Toggle **"Enable"** to ON
   - Click **"Save"**

   **For Other Providers:**
   - Enable Facebook, Twitter, GitHub, etc. as needed
   - Follow the setup instructions for each provider

3. **Configure Authorized Domains**
   - Still in Authentication → Settings
   - Scroll to **"Authorized domains"**
   - Firebase automatically adds your project domain
   - Add your production domain (e.g., `reride.co.in`, `your-app.vercel.app`)
   - Add `localhost` if not already present (for local development)

---

## Step 7: Configure Firebase for Production (Vercel)

Since you're using Vercel for hosting, you need to configure Firebase environment variables in Vercel Dashboard.

### Step-by-Step:

1. **Go to Vercel Dashboard**
   - Visit [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Log in and select your project

2. **Navigate to Environment Variables**
   - Click **"Settings"** in the top navigation
   - Click **"Environment Variables"** in the left sidebar

3. **Add Firebase Environment Variables**

   Add each of these 6 variables **one at a time**:

   | Variable Name | Value | Environment |
   |--------------|-------|-------------|
   | `VITE_FIREBASE_API_KEY` | Your API key from Step 4 | ✅ Production, ✅ Preview, ✅ Development |
   | `VITE_FIREBASE_AUTH_DOMAIN` | Your auth domain | ✅ Production, ✅ Preview, ✅ Development |
   | `VITE_FIREBASE_PROJECT_ID` | Your project ID | ✅ Production, ✅ Preview, ✅ Development |
   | `VITE_FIREBASE_STORAGE_BUCKET` | Your storage bucket | ✅ Production, ✅ Preview, ✅ Development |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID | ✅ Production, ✅ Preview, ✅ Development |
   | `VITE_FIREBASE_APP_ID` | Your app ID | ✅ Production, ✅ Preview, ✅ Development |

   **How to add:**
   - Click **"Add New"**
   - Enter the **Key** (e.g., `VITE_FIREBASE_API_KEY`)
   - Enter the **Value** (paste from your Firebase config)
   - Check all three environments: **Production**, **Preview**, and **Development**
   - Click **"Save"**
   - Repeat for all 6 variables

4. **Redeploy Your Application**
   
   **Important:** After adding environment variables, you MUST redeploy for changes to take effect!
   
   **Option A: Redeploy existing deployment**
   - Go to **"Deployments"** tab
   - Click the **"..."** menu (three dots) on your latest deployment
   - Select **"Redeploy"**
   
   **Option B: Trigger new deployment**
   - Push a new commit to your repository
   - Vercel will automatically deploy with new environment variables

---

## Step 8: Initialize Firebase in Your Project

Your project already has Firebase SDK installed (`firebase@10.7.1` in `package.json`), but let's verify the setup.

### Verify Firebase SDK Installation:

```bash
npm list firebase
```

If not installed, install it:
```bash
npm install firebase
```

### Check Firebase Configuration File:

Your project already has `lib/firebase.ts` which handles Firebase initialization. The file:
- ✅ Initializes Firebase app
- ✅ Sets up Firebase Auth
- ✅ Validates configuration
- ✅ Provides error handling

**No code changes needed** - it's already configured to use your environment variables!

---

## Step 9: Verify Firebase Setup

### Local Verification:

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Check Browser Console**
   - Open your app in browser (usually `http://localhost:5173`)
   - Open Developer Tools (F12)
   - Check Console for Firebase initialization message:
     - ✅ Should see: `✅ Firebase initialized successfully`
     - ❌ Should NOT see: `⚠️ Firebase configuration is missing`

3. **Test Authentication**
   - Try to sign in with your enabled authentication methods
   - Check Firebase Console → Authentication → Users to see if user was created

### Production Verification:

1. **Check Deployment**
   - Visit your production URL (e.g., `https://reride.co.in`)
   - Open Browser Console (F12)
   - Verify no Firebase errors

2. **Test Authentication in Production**
   - Try signing in
   - Verify user appears in Firebase Console → Authentication → Users

---

## Optional: Firebase Hosting Setup

If you want to use Firebase Hosting instead of (or in addition to) Vercel:

### Step 1: Login to Firebase CLI

```bash
firebase login
```

This will:
- Open your browser
- Prompt you to sign in with Google
- Authorize Firebase CLI

### Step 2: Initialize Firebase in Your Project

```bash
firebase init
```

When prompted:

1. **Select features:**
   - ✅ Use arrow keys to navigate
   - ✅ Space to select **"Hosting"**
   - ✅ Enter to confirm

2. **Select a Firebase project:**
   - Choose your project (created in Step 2)

3. **What do you want to use as your public directory?**
   - Answer: `dist` (this is where Vite builds your app)

4. **Configure as a single-page app?**
   - Answer: `Yes` (to rewrite all URLs to `/index.html`)

5. **Set up automatic builds and deploys with GitHub?**
   - Answer: `No` (you're using Vercel)

6. **File dist/index.html already exists. Overwrite?**
   - Answer: `No`

### Step 3: Build and Deploy

```bash
# Build your app
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Your app will be available at: `https://your-project-id.web.app`

---

## Troubleshooting

### Issue: "Firebase: Error (auth/api-key-not-valid)"

**Solution:**
- ✅ Check that `.env.local` exists in project root
- ✅ Verify all 6 Firebase variables are set correctly
- ✅ Ensure variable names start with `VITE_` prefix
- ✅ Restart development server after creating/editing `.env.local`
- ✅ For production: Verify all variables are set in Vercel and redeploy

### Issue: "Firebase configuration is missing or incomplete"

**Solution:**
- ✅ Check browser console for which variables are missing
- ✅ Verify `.env.local` file is in the root directory (not in `src/` or `lib/`)
- ✅ Ensure no typos in variable names
- ✅ Restart dev server after changes

### Issue: "Unauthorized domain" error

**Solution:**
- ✅ Go to Firebase Console → Authentication → Settings
- ✅ Add your domain to "Authorized domains" list
- ✅ For local development, ensure `localhost` is in the list
- ✅ For production, add your Vercel domain (e.g., `your-app.vercel.app`)

### Issue: Firebase works locally but not in production

**Solution:**
- ✅ Verify all 6 environment variables are set in Vercel Dashboard
- ✅ Ensure variables are enabled for **Production** environment
- ✅ Redeploy your application after adding variables
- ✅ Check Vercel deployment logs for errors

### Issue: "auth/domain-not-authorized"

**Solution:**
- ✅ Firebase Console → Authentication → Settings → Authorized domains
- ✅ Add your production domain
- ✅ Wait 1-2 minutes for changes to propagate
- ✅ Clear browser cache and try again

---

## Quick Reference Checklist

### Local Development Setup:
- [ ] Firebase CLI installed (`firebase --version`)
- [ ] Firebase project created in Console
- [ ] Web app registered in Firebase
- [ ] Configuration values copied
- [ ] `.env.local` file created with all 6 variables
- [ ] Authentication methods enabled
- [ ] Dev server restarted
- [ ] Firebase initialization confirmed in browser console

### Production Setup:
- [ ] All 6 Firebase variables added to Vercel
- [ ] Variables enabled for Production, Preview, and Development
- [ ] Application redeployed after adding variables
- [ ] Production domain added to Firebase authorized domains
- [ ] Production authentication tested and working

---

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication Guide](https://firebase.google.com/docs/auth)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## Summary

Your Firebase setup is complete when:

1. ✅ Firebase project created and configured
2. ✅ Web app registered with configuration values
3. ✅ Local `.env.local` file with all 6 variables
4. ✅ Authentication methods enabled
5. ✅ Production environment variables set in Vercel
6. ✅ Application redeployed with new variables
7. ✅ Firebase initialization successful (check browser console)
8. ✅ Authentication tested and working

**Need help?** Check the other Firebase guides in your project:
- `FIREBASE_SETUP_GUIDE.md` - Detailed setup guide
- `FIREBASE_QUICK_SETUP.md` - Quick troubleshooting guide

---

**Last Updated:** 2024






