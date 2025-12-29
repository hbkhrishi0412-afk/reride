# Firebase Environment Variable Setup Guide

## ❌ Common Error

If you see this error:
```
❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON: No number after minus sign in JSON at position 1
Received (first 100 chars): -----BEGIN PRIVATE KEY-----
```

**This means you've set the wrong value!** You've pasted just the private key instead of the full JSON service account file.

## ✅ Correct Setup

### Step 1: Get Your Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the **⚙️ Settings** icon → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **"Generate New Private Key"**
6. Click **"Generate Key"** in the confirmation dialog
7. A JSON file will download (e.g., `your-project-firebase-adminsdk-xxxxx.json`)

### Step 2: Copy the ENTIRE JSON Content

Open the downloaded JSON file. It should look like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCsLQizqeRGaQMz\n...more lines...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com"
}
```

**⚠️ IMPORTANT:** Copy the ENTIRE JSON object (from `{` to `}`), not just the `private_key` field!

### Step 3: Set in Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add/Edit `FIREBASE_SERVICE_ACCOUNT_KEY`:
   - **Key**: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value**: Paste the ENTIRE JSON (all of it, as one line or with `\n` for newlines)
   - **Environments**: Check Production, Preview, Development
5. Click **Save**

### Step 4: Format the JSON for Vercel

Vercel environment variables need the JSON as a single line. You have two options:

#### Option A: Single Line (Recommended)
Remove all line breaks and paste as one line:
```json
{"type":"service_account","project_id":"your-project-id","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCsLQizqeRGaQMz\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",...}
```

#### Option B: With Escaped Newlines
Keep the structure but escape newlines in the `private_key` field:
```json
{"type":"service_account","project_id":"your-project-id","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCsLQizqeRGaQMz\\n...\\n-----END PRIVATE KEY-----\\n",...}
```

**Note:** The `private_key` field should have `\n` (backslash-n) for newlines, not actual line breaks.

### Step 5: Other Required Firebase Environment Variables

Make sure you also have these set in Vercel:

| Variable | Description | Example |
|----------|-------------|---------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Full JSON service account key | `{"type":"service_account",...}` |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | `https://your-project.firebaseio.com` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID | `your-project-id` |

**Client-side variables** (for frontend):
| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |

### Step 6: Redeploy

After setting environment variables:
1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click the **⋯** menu on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger auto-deploy

## 🔍 Verification

After deployment, check the Vercel function logs. You should see:
```
✅ Firebase Admin initialized successfully
```

If you still see errors, check:
1. ✅ JSON is valid (use a JSON validator)
2. ✅ No outer quotes around the JSON
3. ✅ `private_key` field uses `\n` for newlines (not actual line breaks)
4. ✅ All required fields are present (`type`, `project_id`, `private_key`, `client_email`)

## 🛠️ Quick Test

You can test if your Firebase setup is working:

```bash
curl https://your-app.vercel.app/api/system?action=test-connection
```

Should return:
```json
{
  "success": true,
  "message": "Firebase connection test successful"
}
```

## ❌ What NOT to Do

- ❌ Don't paste just the `private_key` field
- ❌ Don't paste just `-----BEGIN PRIVATE KEY-----...`
- ❌ Don't wrap the JSON in extra quotes
- ❌ Don't use actual line breaks in `private_key` (use `\n`)

## ✅ What TO Do

- ✅ Copy the ENTIRE JSON file content
- ✅ Paste it as a single line or with escaped newlines
- ✅ Make sure it starts with `{"type":"service_account",...}`
- ✅ Verify JSON is valid before saving

