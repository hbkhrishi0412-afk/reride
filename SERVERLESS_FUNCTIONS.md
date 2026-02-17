# Serverless Functions Status

## Current Configuration ✅

**Serverless Function Count: 1/12** (Hobby plan limit)

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
node scripts/verify-serverless-functions.js
```

## Adding New API Routes

When adding new API routes:

1. **Option 1 (Recommended)**: Add routing logic in `api/main.ts`
   - Import handler functions as modules
   - Add route matching in `mainHandler` function
   - No new serverless function created ✅

2. **Option 2**: Create a new file with default export
   - Only if you need a completely separate function
   - **Warning**: Each default export = 1 serverless function
   - Current count: 1/12, so you have 11 slots remaining

## Best Practices

- ✅ Keep all routes in `main.ts` for optimal function count
- ✅ Extract handlers to `api/handlers/` for organization
- ✅ Use named exports for handler functions
- ❌ Avoid creating new files with default exports unless necessary

