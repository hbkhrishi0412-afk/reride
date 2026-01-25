# Firebase Login Guide

## Quick Login Steps

### Method 1: Firebase CLI Login (Recommended)
1. Open your terminal/PowerShell
2. Navigate to your project directory:
   ```bash
   cd "C:\Users\bhadr\Downloads\reride (2)"
   ```
3. Run the login command:
   ```bash
   firebase login
   ```
4. This will open your browser - sign in with your Google account
5. Return to the terminal - you should see a success message

### Method 2: Direct Browser Access
Simply open this URL in your browser:
**https://console.firebase.google.com/project/reride-ade6a/database**

Sign in with your Google account that has access to the project.

### Method 3: Service Account (For CI/CD)
If you have a service account JSON key:
1. Set the environment variable:
   ```bash
   $env:GOOGLE_APPLICATION_CREDENTIALS="path\to\service-account-key.json"
   ```
2. Or use in code with Firebase Admin SDK

## Verify Login
After logging in, verify with:
```bash
firebase login:list
```

You should see your account listed.

## Troubleshooting
- **"No authorized accounts"**: Run `firebase login` again
- **Permission denied**: Make sure your Google account has access to the `reride-ade6a` project
- **Project not found**: Contact the project owner to add you as a member










