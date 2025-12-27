# 🔥 Firebase Quick Setup Guide

## Error: "auth/api-key-not-valid"

This error means your Firebase API key is missing or invalid. Follow these steps to fix it:

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter your project name (e.g., "reride-app")
4. Follow the setup wizard:
   - Disable Google Analytics (optional)
   - Click **"Create project"**
   - Wait for project creation to complete

## Step 2: Get Your Firebase Configuration

1. In Firebase Console, click the **gear icon** ⚙️ next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. If you don't have a web app yet:
   - Click the **web icon** `</>`
   - Register your app with a nickname (e.g., "reride-web")
   - Click **"Register app"**
5. You'll see your Firebase configuration. It looks like this:

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

## Step 3: Create `.env.local` File

1. In your project root directory, create a file named `.env.local`
2. Copy the template from `.env.local.example` or create it with these values:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

3. Replace all the placeholder values with your actual Firebase config values

## Step 4: Enable Authentication Methods

1. In Firebase Console, go to **"Authentication"** in the left sidebar
2. Click **"Get started"** (if first time)
3. Go to **"Sign-in method"** tab
4. Enable the methods you want to use:

   **For Google Sign-In:**
   - Click on **"Google"**
   - Toggle **"Enable"**
   - Enter your support email
   - Click **"Save"**

   **For Phone Authentication:**
   - Click on **"Phone"**
   - Toggle **"Enable"**
   - Click **"Save"**

## Step 5: Restart Your Development Server

After creating `.env.local`:

1. Stop your current dev server (Ctrl+C)
2. Restart it:
   ```bash
   npm run dev
   ```

**Important:** Vite only loads `.env.local` on server start, so you must restart!

## Step 6: Verify It Works

1. Open your app in the browser
2. Try to login with Mobile OTP or Google Sign-In
3. The error should be gone!

## Troubleshooting

### Still getting the error?

1. **Check `.env.local` file exists:**
   ```bash
   # Windows PowerShell
   Test-Path .env.local
   
   # Should return: True
   ```

2. **Verify file location:**
   - The `.env.local` file must be in the **root directory** (same folder as `package.json`)
   - Not in `src/`, `lib/`, or any subfolder

3. **Check variable names:**
   - All Firebase variables must start with `VITE_`
   - No spaces around the `=` sign
   - No quotes needed (Vite handles this automatically)

4. **Restart dev server:**
   - Environment variables are only loaded when the server starts
   - Stop and restart: `npm run dev`

5. **Check for typos:**
   - Compare your `.env.local` with the example file
   - Make sure all 6 Firebase variables are present

### Example `.env.local` (with real values):

```env
VITE_FIREBASE_API_KEY=AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz
VITE_FIREBASE_AUTH_DOMAIN=reride-app-12345.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=reride-app-12345
VITE_FIREBASE_STORAGE_BUCKET=reride-app-12345.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=987654321098
VITE_FIREBASE_APP_ID=1:987654321098:web:abcdef1234567890abcdef
```

## For Production (Vercel) - ⚠️ REQUIRED

**If you're seeing this error in production, you MUST configure Firebase environment variables in Vercel!**

The `.env.local` file only works for local development. For production deployments on Vercel, you need to set environment variables in the Vercel Dashboard:

### Step-by-Step Production Setup:

1. **Go to your Vercel project dashboard**
   - Visit [vercel.com](https://vercel.com) and log in
   - Select your project (reride.co.in)

2. **Navigate to Environment Variables**
   - Click **"Settings"** in the top navigation
   - Click **"Environment Variables"** in the left sidebar

3. **Add all 6 Firebase variables** (one at a time):
   - Click **"Add New"**
   - For each variable, enter:
     - **Key**: `VITE_FIREBASE_API_KEY` (or the variable name)
     - **Value**: Your Firebase config value (from Firebase Console)
     - **Environment**: Select **Production**, **Preview**, and **Development** (check all three)
   - Click **"Save"**
   - Repeat for all 6 variables:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`

4. **Redeploy your app**
   - Go to **"Deployments"** tab
   - Click the **"..."** menu on your latest deployment
   - Select **"Redeploy"**
   - Or push a new commit to trigger automatic deployment

### ⚠️ Important Notes:
- Environment variables are case-sensitive
- All variables must start with `VITE_` prefix
- You must enable them for **Production** environment (at minimum)
- After adding variables, you MUST redeploy for changes to take effect
- The `.env.local` file is NOT used in production - only Vercel environment variables are used

## Quick Checklist

- [ ] Firebase project created
- [ ] Web app registered in Firebase Console
- [ ] Configuration values copied
- [ ] `.env.local` file created in project root
- [ ] All 6 Firebase variables added to `.env.local`
- [ ] Google Sign-In enabled (if using)
- [ ] Phone Authentication enabled (if using)
- [ ] Dev server restarted
- [ ] Tested login - no errors!

---

**Need help?** Check the full setup guide: `FIREBASE_SETUP_GUIDE.md`

