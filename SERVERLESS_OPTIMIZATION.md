# Serverless Functions Optimization

## Current Status

✅ **Optimized to 1 Serverless Function**

All API endpoints are now consolidated into a single serverless function: `api/main.ts`

## Changes Made

### 1. Updated vercel.json
- Simplified rewrites to route all `/api/*` requests to `/api/main`
- Removed redundant rewrite rules
- All API endpoints now go through a single function

### 2. Single Handler Architecture
- All endpoints handled in `api/main.ts`
- Internal routing based on pathname
- No separate serverless functions needed

## API Endpoints (All in main.ts)

All these endpoints are handled by the single `api/main.ts` function:

1. `/api/users` - User management & authentication
2. `/api/vehicles` - Vehicle operations
3. `/api/admin` - Admin operations
4. `/api/db-health` - Database health check
5. `/api/seed` - Database seeding
6. `/api/vehicle-data` - Vehicle data management
7. `/api/new-cars` - New car catalog
8. `/api/system` - System operations
9. `/api/utils` - Utility endpoints
10. `/api/ai` or `/api/gemini` - AI features
11. `/api/content` - Content management (FAQs, support tickets)
12. `/api/sell-car` - Sell car submissions
13. `/api/payments` - Payment processing
14. `/api/plans` - Subscription plans
15. `/api/business` - Business operations

## Benefits

1. **Reduced Cold Starts**: Only 1 function to initialize
2. **Lower Costs**: Single function instead of multiple
3. **Easier Maintenance**: All API logic in one place
4. **Better Performance**: Shared connection pooling
5. **Simpler Deployment**: Less complexity

## How It Works

1. Vercel receives request to `/api/users`
2. Rewrite rule routes it to `/api/main`
3. `main.ts` handler extracts original pathname from `req.url`
4. Internal routing logic directs to appropriate handler function
5. Response is returned

## Verification

After deployment, verify:
- Only 1 serverless function appears in Vercel dashboard
- All API endpoints work correctly
- No 404 errors on API routes
- Response times are acceptable

## Testing

Test all endpoints:
```bash
# Users
curl https://your-app.vercel.app/api/users

# Vehicles
curl https://your-app.vercel.app/api/vehicles

# Health
curl https://your-app.vercel.app/api/db-health

# Admin
curl https://your-app.vercel.app/api/admin
```

All should work through the single `main.ts` function.

