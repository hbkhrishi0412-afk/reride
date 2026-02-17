# Serverless Functions Status

## Current Configuration ✅

**Serverless Function Count: 1/10** (Maximum allowed: 10)

### Active Serverless Function
- `api/main.ts` - Main API handler that routes all `/api/*` requests

### Modules (Not Counted as Functions)
All other files in the `api/` directory are modules without default exports:
- `api/auth.ts` - Authentication utilities
- `api/chat.js` - Chat handler (imported by main.ts)
- `api/chat-websocket.js` - WebSocket utilities
- `api/login.ts` - Login handler (imported by main.ts)
- `api/provider-services.ts` - Provider services handler (imported by main.ts)
- `api/service-providers.ts` - Service providers handler (imported by main.ts)
- `api/service-requests.ts` - Service requests handler (imported by main.ts)
- `api/services.ts` - Services handler (imported by main.ts)
- `api/handlers/*` - Modular handler functions (imported by main.ts)

## Routing Configuration

All API routes are handled through `api/main.ts` via the Vercel rewrite rule in `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/main.ts"
    }
  ]
}
```

This means:
- ✅ All `/api/*` requests are routed to `api/main.ts`
- ✅ `main.ts` then routes to appropriate handlers based on pathname
- ✅ Only 1 serverless function is deployed (well under the 12 limit)

## Verification

Run the verification script to check function count:

```bash
npm run verify:functions
```

Or directly:
```bash
node scripts/verify-serverless-functions.js
```

**Maximum Allowed: 10 functions** - The script will fail if this limit is exceeded.

## Adding New API Routes

When adding new API routes:

1. **Option 1 (Recommended)**: Add routing logic in `api/main.ts`
   - Import handler functions as modules
   - Add route matching in `mainHandler` function
   - No new serverless function created ✅

2. **Option 2**: Create a new file with default export
   - Only if you need a completely separate function
   - **Warning**: Each default export = 1 serverless function
   - **CRITICAL**: Current count: 1/10, so you have 9 slots remaining
   - **DO NOT EXCEED 10 FUNCTIONS** - Always verify before adding new functions

## Safeguards

To prevent exceeding the 10-function limit, several safeguards are in place:

1. **Verification Script**: Run `npm run verify:functions` to check count
2. **Pre-commit Hook**: Automatically verifies function count before each commit (if husky is set up)
3. **GitHub Actions**: CI/CD pipeline verifies function count on pull requests and pushes
4. **Documentation**: This file serves as a reference for the limit

## Best Practices

- ✅ Keep all routes in `main.ts` for optimal function count
- ✅ Extract handlers to `api/handlers/` for organization
- ✅ Use named exports for handler functions
- ✅ Always run `npm run verify:functions` before adding new API files
- ❌ Avoid creating new files with default exports unless absolutely necessary
- ❌ Never exceed 10 serverless functions

