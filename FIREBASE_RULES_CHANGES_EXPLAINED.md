# Firebase Security Rules - Required Changes

## ❌ Issues with Your Current Rules

### 1. **Users Collection - Wrong Key Matching**
**Current Rule:**
```json
"$userId": {
  ".read": "auth != null && ($userId == auth.uid || ...)"
}
```

**Problem:** Your users are keyed by **email** (e.g., `user@example_com`), not by Firebase UID. So `$userId == auth.uid` will **never match**.

**Fix:** Match by `firebaseUid` **field** inside the user data:
```json
".read": "auth != null && data.child('firebaseUid').val() == auth.uid"
```

### 2. **Conversations - Wrong ID Type**
**Current Rule:**
```json
".read": "auth != null && (data.child('customerId').val() == auth.uid || ...)"
```

**Problem:** `customerId` and `sellerId` are **emails** (strings), not Firebase UIDs. So `== auth.uid` will **never match**.

**Fix:** Since we can't easily look up user email from UID in rules, we allow authenticated access and validate on server:
```json
".read": "auth != null"
```

### 3. **Vehicles - auth.token.email Not Available**
**Current Rule:**
```json
".write": "auth != null && (data.child('sellerEmail').val() == auth.token.email || ...)"
```

**Problem:** `auth.token.email` is **not available** in Realtime Database security rules (only in Firestore).

**Fix:** Allow authenticated write, validate `sellerEmail` match on server:
```json
".write": "auth != null"
```

### 4. **Admin Role Check - Wrong Path**
**Current Rule:**
```json
"root.child('users').child(auth.uid).child('role').val() == 'admin'"
```

**Problem:** Users are keyed by **email**, not UID. This lookup will **always fail**.

**Fix:** For admin checks, use Firebase Admin SDK in serverless functions (bypasses rules). Rules handle basic access control.

## ✅ Corrected Rules

Use the rules from `FIREBASE_RULES_CORRECTED.json`. Key changes:

1. ✅ **Users**: Match by `firebaseUid` field (not key)
2. ✅ **Public Fields**: Seller profile info is publicly readable
3. ✅ **Password**: Never readable (`.read: false`)
4. ✅ **Vehicles**: Public read for published, authenticated write
5. ✅ **Conversations**: Authenticated access (server validates participants)
6. ✅ **Business Logic**: Handled on server, not in rules

## 🔒 Security Model

### Client-Side (Security Rules)
- ✅ Basic access control
- ✅ Password protection
- ✅ Public seller profiles
- ✅ Published vehicle browsing

### Server-Side (API Routes)
- ✅ Business logic validation (sellerEmail match, participant check)
- ✅ Admin role checks
- ✅ Use Firebase Admin SDK for full access

## 📋 What to Do

1. **Copy** the rules from `FIREBASE_RULES_CORRECTED.json`
2. **Paste** into Firebase Console → Realtime Database → Rules
3. **Publish** the rules
4. **Ensure** your server-side API validates:
   - `sellerEmail` matches authenticated user's email when creating/updating vehicles
   - `customerId`/`sellerId` matches authenticated user's email for conversations
   - Admin role for admin-only operations

## ⚠️ Important Notes

1. **Server Validation Required**: Since rules can't easily match emails to UIDs, your API must validate business logic
2. **Admin SDK**: Use Firebase Admin SDK in serverless functions for admin operations
3. **Password Safety**: Passwords are never readable, even by owners (only writable)
4. **Public Data**: Seller profiles and published vehicles are publicly readable (required for browsing)

## 🧪 Testing

After updating rules, test:
- ✅ Can browse published vehicles without login
- ✅ Can view seller profiles without login
- ✅ Can't read passwords
- ✅ Can update own user profile when authenticated
- ✅ Can create vehicles when authenticated (server validates sellerEmail)

