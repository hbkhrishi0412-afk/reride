# How to Deploy Firebase Database Rules

## Step 1: Enable Anonymous Authentication

1. Go to https://console.firebase.google.com/
2. Select your project
3. Navigate to: **Authentication** → **Sign-in method**
4. Click on **Anonymous** provider
5. **Enable** it and click **Save**

## Step 2: Deploy Database Rules

### Option A: Using Firebase CLI (Recommended)

```bash
# If you don't have Firebase CLI, install it first:
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy only database rules
firebase deploy --only database
```

### Option B: Manual Deployment via Firebase Console

1. Go to https://console.firebase.google.com/
2. Select your project
3. Navigate to: **Realtime Database** → **Rules** tab
4. Open `firebase-database-rules.json` file from your project
5. Copy the entire content (everything inside the file)
6. Paste into the Firebase Rules editor
7. Click **Publish** button

## Step 3: Verify Deployment

After deploying, check that the image upload rule looks like this in Firebase Console:

```json
"images": {
  ".read": true,
  "$folder": {
    ".read": true,
    "$imageId": {
      ".read": true,
      ".write": "auth != null && newData.child('uploadedBy').exists() && newData.child('uploadedBy').val() != null && newData.child('uploadedBy').val() != ''"
    }
  }
}
```

## Troubleshooting

- **Error persists?** Make sure you clicked "Publish" after pasting rules
- **Still permission denied?** Check browser console for detailed Firebase errors
- **Anonymous auth not working?** Verify it's enabled in Authentication → Sign-in method


