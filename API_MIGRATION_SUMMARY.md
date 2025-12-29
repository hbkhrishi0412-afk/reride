# API Migration Summary: MongoDB to Firebase

## Overview

The API routes in `api/main.ts` have been partially updated to support Firebase Realtime Database. The migration uses a feature flag approach where you can switch between MongoDB and Firebase using the `DB_MODE` environment variable.

## Current Status

✅ **Completed:**
- Firebase database service layer (`lib/firebase-db.ts`)
- Firebase user service (`services/firebase-user-service.ts`)
- Firebase vehicle service (`services/firebase-vehicle-service.ts`)
- Firebase conversation service (`services/firebase-conversation-service.ts`)
- Migration script (`scripts/migrate-mongodb-to-firebase.js`)
- Environment configuration updated

🔄 **In Progress:**
- API route updates (partially complete)

## How to Use

### Option 1: Use Firebase (Recommended)

Set environment variable:
```env
DB_MODE=firebase
```

### Option 2: Use MongoDB (Fallback)

Set environment variable:
```env
DB_MODE=mongodb
```

Or simply don't set `DB_MODE` and it will default to Firebase if available.

## Key Changes Needed in api/main.ts

The API file is large (5000+ lines), so here are the key patterns to update:

### Pattern 1: User Operations

**Before (MongoDB):**
```typescript
const user = await User.findOne({ email: normalizedEmail });
const newUser = new User({ ... });
await newUser.save();
```

**After (Firebase):**
```typescript
const user = await firebaseUserService.findByEmail(normalizedEmail);
const newUser = await firebaseUserService.create({ ... });
```

### Pattern 2: Vehicle Operations

**Before (MongoDB):**
```typescript
const vehicle = await Vehicle.findOne({ id: vehicleId });
const newVehicle = new Vehicle({ ... });
await newVehicle.save();
```

**After (Firebase):**
```typescript
const vehicle = await firebaseVehicleService.findById(vehicleId);
const newVehicle = await firebaseVehicleService.create({ ... });
```

### Pattern 3: Conversation Operations

**Before (MongoDB):**
```typescript
const conversation = await Conversation.findOne({ id: conversationId });
const newConversation = new Conversation({ ... });
await newConversation.save();
```

**After (Firebase):**
```typescript
const conversation = await firebaseConversationService.findById(conversationId);
const newConversation = await firebaseConversationService.create({ ... });
```

## Example: Updated User Login Endpoint

Here's how the login endpoint should be updated:

```typescript
// LOGIN
if (action === 'login') {
  if (!email || !password) {
    return res.status(400).json({ success: false, reason: 'Email and password are required.' });
  }
  
  const sanitizedData = await sanitizeObject({ email, password, role });
  const normalizedEmail = sanitizedData.email.toLowerCase().trim();
  
  // Use Firebase if available, otherwise MongoDB
  let user: UserType | null = null;
  
  if (USE_FIREBASE) {
    user = await firebaseUserService.findByEmail(normalizedEmail);
  } else {
    const userDoc = await User.findOne({ email: normalizedEmail }).lean() as UserDocument | null;
    user = normalizeUser(userDoc);
  }
  
  if (!user) {
    return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
  }
  
  // Rest of the login logic remains the same...
}
```

## Migration Checklist

- [x] Create Firebase database service
- [x] Create Firebase user service
- [x] Create Firebase vehicle service
- [x] Create Firebase conversation service
- [x] Update environment configuration
- [x] Create migration script
- [ ] Update user authentication endpoints (login, register, oauth-login)
- [ ] Update user profile endpoints (GET, PUT, DELETE)
- [ ] Update vehicle endpoints (GET, POST, PUT, DELETE)
- [ ] Update conversation endpoints
- [ ] Update notification endpoints
- [ ] Update admin endpoints
- [ ] Test all endpoints
- [ ] Update error handling for Firebase
- [ ] Remove MongoDB dependencies (optional)

## Testing

After updating endpoints, test:

1. **User Operations:**
   - Registration
   - Login (email/password)
   - OAuth login
   - Profile update
   - Profile deletion

2. **Vehicle Operations:**
   - List vehicles
   - Get vehicle by ID
   - Create vehicle
   - Update vehicle
   - Delete vehicle
   - Search/filter vehicles

3. **Conversation Operations:**
   - Create conversation
   - Get conversations
   - Add messages
   - Update conversation

## Notes

1. **Data Normalization**: Firebase services return data in a normalized format (with `id` field), so you may not need the `normalizeUser` function in some cases.

2. **Error Handling**: Firebase errors are different from MongoDB errors. Update error handling accordingly.

3. **Transactions**: Firebase Realtime Database doesn't support transactions like MongoDB. If you need atomic operations, consider using Firebase Firestore instead.

4. **Queries**: Firebase Realtime Database has different query capabilities. Complex queries may need to be restructured.

5. **Indexes**: Firebase Realtime Database doesn't have indexes like MongoDB. Structure your data for efficient queries.

## Next Steps

1. Run the migration script to move existing data:
   ```bash
   npm run migrate:mongodb-to-firebase
   ```

2. Set `DB_MODE=firebase` in your environment

3. Test the application with Firebase

4. Gradually update remaining endpoints to use Firebase services

5. Once all endpoints are updated and tested, you can remove MongoDB dependencies

## Support

If you encounter issues:
- Check Firebase Console for database access logs
- Verify environment variables are set correctly
- Check Firebase Realtime Database rules
- Review error logs in the console





