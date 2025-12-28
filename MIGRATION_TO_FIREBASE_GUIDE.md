# Migration Guide: MongoDB to Firebase Realtime Database

This guide will help you migrate your database from MongoDB to Firebase Realtime Database.

## Prerequisites

1. **Firebase Project Setup**
   - You already have a Firebase project with Realtime Database enabled
   - Your Firebase Realtime Database URL: `https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/`

2. **Environment Variables**
   - Ensure you have all Firebase configuration variables set
   - MongoDB connection string (for migration only)

## Step 1: Update Environment Variables

Add the Firebase Realtime Database URL to your environment variables:

### For Local Development (.env.local):
```env
FIREBASE_DATABASE_URL=https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/
```

### For Production (Vercel):
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add: `FIREBASE_DATABASE_URL` with value: `https://reride-ade6a-default-rtdb.asia-southeast1.firebasedatabase.app/`

## Step 2: Install Dependencies (if needed)

The migration script uses Firebase SDK which is already installed. If you want to use dotenv for easier environment variable management:

```bash
npm install --save-dev dotenv
```

## Step 3: Run the Migration Script

Before running the migration, make sure you have:
- MongoDB connection string set (`MONGODB_URI` or `MONGODB_URL`)
- All Firebase environment variables set
- `FIREBASE_DATABASE_URL` set

Then run:

```bash
npm run migrate:mongodb-to-firebase
```

This will:
1. Connect to your MongoDB database
2. Read all users, vehicles, conversations, and notifications
3. Migrate them to Firebase Realtime Database
4. Provide a summary of migrated data

## Step 4: Verify Migration

After migration, you can verify the data in Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Realtime Database
4. Check that your data is present under:
   - `users/`
   - `vehicles/`
   - `conversations/`
   - `notifications/`

## Step 5: Update API Routes

The API routes have been updated to use Firebase Realtime Database instead of MongoDB. The new services are:

- `services/firebase-user-service.ts` - User operations
- `services/firebase-vehicle-service.ts` - Vehicle operations
- `services/firebase-conversation-service.ts` - Conversation operations

## Step 6: Test Your Application

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Test key functionality:
   - User registration/login
   - Vehicle listing/creation
   - Conversations/messaging
   - Notifications

## Important Notes

### Data Structure Changes

1. **Users**: Stored by email key (email with special characters replaced)
   - Path: `users/{emailKey}`
   - Example: `users/john_example_com`

2. **Vehicles**: Stored by vehicle ID
   - Path: `vehicles/{vehicleId}`
   - Example: `vehicles/12345`

3. **Conversations**: Stored by conversation ID
   - Path: `conversations/{conversationId}`
   - Example: `conversations/customer123_456`

### Firebase Realtime Database Rules

Make sure your Firebase Realtime Database rules allow read/write access. For development, you can use:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

For production, implement proper security rules based on your authentication and authorization needs.

### Rollback Plan

If you need to rollback:
1. Keep your MongoDB connection string
2. The old MongoDB code is still in the codebase (commented out)
3. You can switch back by updating the API routes to use MongoDB services again

## Troubleshooting

### Migration Script Fails

1. **Connection Issues**:
   - Verify MongoDB connection string is correct
   - Check network connectivity
   - Ensure MongoDB allows connections from your IP

2. **Firebase Issues**:
   - Verify all Firebase environment variables are set
   - Check Firebase Realtime Database is enabled
   - Verify database URL is correct

3. **Permission Issues**:
   - Check Firebase Realtime Database rules
   - Ensure you have write permissions

### API Routes Not Working

1. **Check Environment Variables**:
   - Verify `FIREBASE_DATABASE_URL` is set
   - Check all Firebase config variables

2. **Check Firebase Initialization**:
   - Look for Firebase initialization errors in console
   - Verify Firebase app is properly initialized

3. **Check Database Rules**:
   - Ensure Firebase rules allow read/write operations
   - Check authentication requirements

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Check Firebase Console for database access logs
4. Review Firebase Realtime Database rules

## Next Steps

After successful migration:
1. Remove MongoDB dependencies (optional, if not needed)
2. Update documentation
3. Monitor Firebase usage and costs
4. Set up proper Firebase security rules
5. Consider implementing Firebase indexes for better query performance


