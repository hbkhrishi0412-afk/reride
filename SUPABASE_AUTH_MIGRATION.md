# Supabase Authentication Migration Guide

## Status: Partially Complete ✅

### ✅ Completed
1. **Supabase Auth Service Created** (`services/supabase-auth-service.ts`)
   - Email/password authentication
   - Google OAuth
   - Session management
   - Password reset

2. **Token Verification Updated**
   - `server/supabase-auth.ts` - Helper for verifying Supabase JWT tokens
   - `api/login.ts` - Now verifies Supabase tokens
   - `api/service-requests.ts` - Uses Supabase token verification
   - `api/service-providers.ts` - Uses Supabase token verification
   - `api/provider-services.ts` - Uses Supabase token verification

### 🔄 Remaining Tasks

#### 1. Update API Login/Register (`api/main.ts`)
The API currently uses custom JWT tokens. To fully migrate to Supabase Auth:

**Option A: Use Supabase Auth (Recommended)**
- Replace custom JWT generation with Supabase `signInWithPassword` / `signUp`
- Return Supabase session tokens instead of custom JWTs
- Update frontend to use Supabase session tokens

**Option B: Hybrid Approach (Easier Migration)**
- Keep custom JWT system for backward compatibility
- Add Supabase Auth as alternative
- Gradually migrate frontend components

#### 2. Update Frontend Authentication
Files to update:
- `services/authService.ts` - Replace Firebase Auth with Supabase Auth
- `services/userService.ts` - Update to use Supabase Auth
- `utils/authenticatedFetch.ts` - Use Supabase session tokens
- All login/register components

#### 3. Update Token Storage
Currently using:
- `localStorage.getItem('reRideAccessToken')`
- `localStorage.getItem('reRideRefreshToken')`

Should use:
- Supabase automatically manages session in localStorage
- Access via `supabase.auth.getSession()`

## Quick Start: Using Supabase Auth

### Frontend Example

```typescript
import { signInWithEmail, signUpWithEmail } from '../services/supabase-auth-service';

// Login
const result = await signInWithEmail(email, password);
if (result.success && result.session) {
  // Session is automatically stored by Supabase
  // Access token: result.session.access_token
  // User: result.session.user
}

// Register
const result = await signUpWithEmail(email, password, {
  name: 'John Doe',
  mobile: '+1234567890',
  role: 'customer'
});
```

### API Route Example

```typescript
import { verifyIdTokenFromHeader } from '../server/supabase-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { uid, email } = await verifyIdTokenFromHeader(req);
    // Use uid and email for authenticated operations
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

## Migration Steps

1. **Test Supabase Auth Service**
   - Verify login/register works with Supabase
   - Test Google OAuth flow
   - Verify session management

2. **Update API Routes**
   - Update `api/main.ts` login/register handlers
   - Keep backward compatibility during transition

3. **Update Frontend**
   - Replace Firebase Auth calls with Supabase Auth
   - Update token storage/retrieval
   - Test all authentication flows

4. **Remove Firebase Auth**
   - Remove Firebase Auth dependencies
   - Clean up unused code
   - Update environment variables

## Environment Variables Needed

```bash
# Supabase (already set)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Firebase Auth (can be removed after migration)
# VITE_FIREBASE_API_KEY (remove)
# VITE_FIREBASE_AUTH_DOMAIN (remove)
# etc.
```

## Notes

- Supabase Auth automatically handles:
  - Session persistence
  - Token refresh
  - Email verification
  - Password reset flows

- Custom JWT system can be kept for:
  - Backward compatibility
  - Additional custom claims
  - Legacy API support



