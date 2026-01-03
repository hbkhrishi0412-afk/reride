# Token Expiration Settings Review

## Current Configuration

### JWT Token Expiration Settings

**Location**: `utils/security-config.ts` and `utils/security-config.js`

```typescript
JWT: {
  ACCESS_TOKEN_EXPIRES_IN: '24h',    // Access tokens expire after 24 hours
  REFRESH_TOKEN_EXPIRES_IN: '7d',    // Refresh tokens expire after 7 days
  ISSUER: 'reride-app',
  AUDIENCE: 'reride-users'
}
```

### Session Management Settings

**Location**: `utils/security-config.ts` (lines 91-95)

```typescript
SESSION: {
  MAX_INACTIVITY: 30 * 60 * 1000,        // 30 minutes of inactivity
  MAX_SESSION_DURATION: 24 * 60 * 60 * 1000  // 24 hours maximum session duration
}
```

## Implementation Details

### Token Generation
- **File**: `utils/security.ts`
- Access tokens are generated using `generateAccessToken()` (line 71)
- Refresh tokens are generated using `generateRefreshToken()` (line 90)
- Both use the expiration settings from `security-config.ts`

### Token Validation
- **File**: `utils/security.ts` - `verifyToken()` function (line 119)
- Tokens are validated with issuer and audience checks
- Expired tokens throw: `'Invalid or expired token'`

### Client-Side Token Management
- **File**: `utils/authenticatedFetch.ts`
- `isTokenLikelyValid()` function checks token expiration client-side (line 99)
- Proactive token refresh if token expires within 30 seconds (line 114)
- Automatic token refresh on 401 responses (line 192)

## Token Storage
- Access Token: `localStorage.getItem('reRideAccessToken')`
- Refresh Token: `localStorage.getItem('reRideRefreshToken')`
- Current User: `localStorage.getItem('reRideCurrentUser')`

## Current Settings Summary

| Token Type | Expiration Time | Notes |
|------------|----------------|-------|
| Access Token | **24 hours** | Short-lived, used for API requests |
| Refresh Token | **7 days** | Long-lived, used to refresh access tokens |
| Session Inactivity | **30 minutes** | Session expires after inactivity |
| Max Session Duration | **24 hours** | Maximum session lifetime |

## Configuration Files

1. **Primary Config (TypeScript)**: `utils/security-config.ts` (lines 28-29)
2. **JavaScript Version**: `utils/security-config.js` (lines 42-43)
3. **Implementation**: `utils/security.ts` (lines 84, 102)
4. **Client Handling**: `utils/authenticatedFetch.ts`

## Recommendations for Review

1. ✅ **Access Token (24h)**: Reasonable for web applications - provides good security while maintaining usability
2. ✅ **Refresh Token (7d)**: Appropriate duration - balances security and user convenience
3. ✅ **Session Inactivity (30min)**: Standard timeout - good security practice
4. ✅ **Token Refresh Logic**: Automatic refresh on 401 and proactive refresh (30s buffer)

## Notes

- Both TypeScript and JavaScript versions of the config file exist (ensure they stay in sync)
- Token expiration is enforced server-side in `utils/security.ts`
- Client-side checks are for optimization only - server validation is authoritative
- JWT_SECRET environment variable must be set in production (currently uses fallback in dev)





