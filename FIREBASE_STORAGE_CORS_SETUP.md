# Firebase Storage CORS Configuration

## Problem
CORS errors occur when uploading images to Firebase Storage from `https://www.reride.co.in`. The browser blocks cross-origin requests because Firebase Storage doesn't have CORS configured.

## Solution
Configure CORS for your Firebase Storage bucket using Google Cloud Storage's `gsutil` tool.

## Steps to Fix

### Step 1: Deploy Firebase Storage Rules

First, deploy the storage security rules:

```bash
firebase deploy --only storage
```

Or if you have Firebase CLI installed:
```bash
firebase deploy --only storage:rules
```

### Step 2: Configure CORS

#### Option A: Using gsutil (Recommended)

### 1. Install Google Cloud SDK (if not already installed)
```bash
# macOS
brew install google-cloud-sdk

# Windows
# Download from: https://cloud.google.com/sdk/docs/install

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### 2. Authenticate with Google Cloud
```bash
gcloud auth login
gcloud config set project reride-ade6a
```

### 3. Apply CORS Configuration

**Important**: Replace `reride-ade6a` with your actual Firebase project ID if different.
```bash
gsutil cors set firebase-storage-cors.json gs://reride-ade6a.firebasestorage.app
```

### 4. Verify CORS Configuration

#### Option B: Using Firebase Console (Alternative)
```bash
gsutil cors get gs://reride-ade6a.firebasestorage.app
```

1. Go to [Google Cloud Console](https://console.cloud.google.com/storage/browser)
2. Select your Firebase project: `reride-ade6a`
3. Navigate to Cloud Storage → Buckets
4. Click on your storage bucket: `reride-ade6a.firebasestorage.app`
5. Go to the "Configuration" tab
6. Scroll to "CORS configuration"
7. Click "Edit CORS configuration"
8. Paste the contents of `firebase-storage-cors.json`
9. Save

## CORS Configuration Details

The `firebase-storage-cors.json` file allows:
- **Origins**: `https://www.reride.co.in`, `https://reride.co.in`, and all Vercel preview deployments
- **Methods**: GET, HEAD, POST, PUT, DELETE
- **Headers**: Content-Type, Authorization, and CORS headers
- **Max Age**: 3600 seconds (1 hour)

## Troubleshooting

If you still see CORS errors after configuration:

1. **Clear browser cache** - CORS settings may be cached
2. **Wait a few minutes** - CORS changes can take time to propagate
3. **Check bucket name** - Ensure you're using the correct bucket: `reride-ade6a.firebasestorage.app`
4. **Verify origin** - Make sure your domain matches exactly (including `www.` or not)
5. **Check Firebase Storage Rules** - Ensure rules allow uploads:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

## Testing

After configuration, test by:
1. Opening browser DevTools → Network tab
2. Attempting to upload an image
3. Checking that the OPTIONS preflight request returns 200 OK
4. Verifying the POST request succeeds

