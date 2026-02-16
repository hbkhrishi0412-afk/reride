# Service Provider Login Fix

## Issue
When a user registers as a service provider, they are stored in the `users` table with `role: 'seller'` and also have a profile in the `service_providers` table. However, they could potentially login through the regular seller login form, which should not be allowed.

## Root Cause
- Service providers are stored with `role: 'seller'` in the users table (for admin panel compatibility)
- The login API only checked if the user's role matched the requested role
- There was no check to see if a seller was actually a service provider
- Service providers should only be able to login through the dedicated service provider login page

## Fix Applied

### 1. API Login Validation (`api/main.ts`)
Added a check in the login handler to detect if a user with role 'seller' is actually a service provider:

```typescript
// CRITICAL FIX: Check if user is a service provider trying to login as regular seller
if (user.role === 'seller') {
  try {
    const serviceProvider = await supabaseServiceProviderService.findByEmail(normalizedEmail);
    if (serviceProvider) {
      // User is a service provider - they must use the service provider login page
      return res.status(403).json({ 
        success: false, 
        reason: 'Service providers must login through the Service Provider login page.',
        isServiceProvider: true
      });
    }
  } catch (spError) {
    // If service provider lookup fails, log but don't block login
    // This ensures regular sellers can still login even if service provider service has issues
    logWarn('⚠️ Error checking service provider status:', spError);
  }
}
```

**Key Points:**
- Only checks sellers (not customers or admins)
- If service provider profile exists, login is rejected with specific error
- Error includes `isServiceProvider: true` flag for frontend handling
- If lookup fails, regular sellers can still login (graceful degradation)

### 2. Frontend Error Handling (`components/UnifiedLogin.tsx`)
Updated the login error handling to detect service provider errors and redirect:

```typescript
// Check if user is a service provider trying to login through regular form
const isServiceProvider = (result as any).isServiceProvider;

if (isServiceProvider) {
  // Redirect to service provider login page
  setError('Service providers must login through the Service Provider login page.');
  setTimeout(() => {
    onNavigate(View.CAR_SERVICE_LOGIN);
  }, 2000);
  return;
}
```

**Key Points:**
- Detects `isServiceProvider` flag from API response
- Shows error message to user
- Automatically redirects to service provider login page after 2 seconds

### 3. Service Response Type (`services/userService.ts`)
Updated to pass through the `isServiceProvider` flag:

```typescript
return {
  success: result.success,
  reason: result.reason,
  detectedRole: result.detectedRole,
  isServiceProvider: result.isServiceProvider
};
```

## Files Modified

1. **`api/main.ts`**
   - Added import for `supabaseServiceProviderService`
   - Added service provider check in login handler (lines ~978-995)

2. **`components/UnifiedLogin.tsx`**
   - Added service provider error detection and redirect (lines ~130-140)

3. **`services/userService.ts`**
   - Updated to pass through `isServiceProvider` flag (line ~877)

## Testing

### Test Case 1: Service Provider Login Attempt via Regular Form
1. Register as a service provider
2. Try to login through regular seller login form
3. **Expected:** Login should be rejected with message "Service providers must login through the Service Provider login page."
4. **Expected:** User should be redirected to service provider login page after 2 seconds

### Test Case 2: Regular Seller Login
1. Register as a regular seller (not service provider)
2. Login through seller login form
3. **Expected:** Login should succeed normally

### Test Case 3: Service Provider Login via Correct Page
1. Register as a service provider
2. Login through `CarServiceLogin` component
3. **Expected:** Login should succeed and redirect to service provider dashboard

### Test Case 4: Customer Login
1. Register as a customer
2. Login through customer login form
3. **Expected:** Login should succeed normally (no service provider check needed)

## Security Benefits

1. **Role Separation:** Service providers are now properly separated from regular sellers
2. **Forced Correct Login Path:** Service providers must use the dedicated login page
3. **Clear Error Messages:** Users get clear guidance on where to login
4. **Graceful Degradation:** If service provider lookup fails, regular sellers can still login

## Notes

- Service providers are still stored with `role: 'seller'` in the users table for admin panel compatibility
- The service provider profile in `service_providers` table is the source of truth for service provider status
- Regular sellers (without service provider profile) can still login normally
- The check only applies to users with `role: 'seller'` to avoid unnecessary database queries

