# Serverless Functions Status

## Current Configuration ✅

**Serverless Function Count: 10/10** (Maximum: 10)

Vercel counts **every** `.ts`/`.js` file under `api/` as one serverless function (not just files with a default export).

### Files in api/ (each = 1 function)
- `api/main.ts` - Main API handler; most `/api/*` requests are rewritten here
- `api/send-sms-hook.ts` - Supabase Auth **Send SMS** hook (raw body + Standard Webhooks verify); `bodyParser: false`
- `api/auth.ts` - Authentication utilities
- `api/chat.js` - Chat handler (imported by main.ts)
- `api/chat-websocket.js` - WebSocket utilities
- `api/login.ts` - Login handler (imported by main.ts)
- `api/provider-services.ts` - Provider services (imported by main.ts)
- `api/service-providers.ts` - Service providers (imported by main.ts)
- `api/service-requests.ts` - Service requests (imported by main.ts)
- `api/services.ts` - Services handler (imported by main.ts)

Shared modules **not** counted as separate functions: `lib/vehicleCatalogSupabase.ts`, `lib/api-route-cors.ts`, `server/sendSmsHook.ts`, `server/handlers/*`.

### Not in api/ (not counted by Vercel)
- `server/handlers/*` - Handler modules (admin, system, content, sell-car, shared, index); imported by main.ts when needed

## Routing Configuration

`vercel.json` routes `/api/send-sms-hook` to its own function (required for raw body / webhook signature). All other `/api/*` traffic goes to `api/main.ts`:

```json
{
  "rewrites": [
    { "source": "/api/send-sms-hook", "destination": "/api/send-sms-hook.ts" },
    { "source": "/api/(.*)", "destination": "/api/main.ts" }
  ]
}
```

This means:
- ✅ `/api/send-sms-hook` → `api/send-sms-hook.ts` (Supabase SMS hook)
- ✅ Other `/api/*` → `api/main.ts` and internal handlers

## Verification

Run the verification script to check function count:

```bash
npm run verify:functions
```

Or directly:
```bash
node scripts/verify-serverless-functions.js
```

**Maximum Allowed: 10 functions** — The script will fail if this limit is exceeded.

## Adding New API Routes

When adding new API routes:

1. **Option 1 (Recommended)**: Add routing logic in `api/main.ts`
   - Import handler functions as modules
   - Add route matching in `mainHandler` function
   - No new serverless function created ✅

2. **Option 2**: Add a new file under `api/`
   - **Warning**: Every file in api/ = 1 serverless function
   - **CRITICAL**: Current count: **10/10** — at the limit. Consolidate or move code out of `api/` before adding another file.
   - **DO NOT EXCEED 10 FUNCTIONS** — Always run `npm run verify:functions` before adding files under api/

## Safeguards

To prevent exceeding the 10-function limit, several safeguards are in place:

1. **Verification Script**: Run `npm run verify:functions` to check count
2. **Pre-commit Hook**: Automatically verifies function count before each commit (if husky is set up)
3. **GitHub Actions**: CI/CD pipeline verifies function count on pull requests and pushes
4. **Documentation**: This file serves as a reference for the limit

## Best Practices

- ✅ Keep routing in `api/main.ts`; put handler logic in `server/handlers/` or `lib/` (not in api/) to avoid increasing the count
- ✅ Use named exports for handler functions
- ✅ Always run `npm run verify:functions` before adding new files under api/
- ❌ Avoid adding new files under api/ unless necessary (each file = 1 function)
- ❌ Never exceed 10 serverless functions
