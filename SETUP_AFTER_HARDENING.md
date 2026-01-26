# Setup Guide After Hardening

Follow these steps to complete the setup after the hardening changes.

## 1. Install New Dependencies

```bash
npm install
```

This will install:
- ESLint and plugins
- Prettier and plugins
- Husky for git hooks
- axe-playwright for accessibility tests

## 2. Initialize Husky

```bash
npx husky install
```

This sets up the pre-commit hooks that will automatically lint and format your code before commits.

## 3. Verify Setup

### Run Linting
```bash
npm run lint
```

### Check Formatting
```bash
npm run format:check
```

### Type Check
```bash
npm run type-check
```

### Run Tests
```bash
npm test
npm run test:e2e
```

## 4. Optional: Set Up Sentry (Error Tracking)

1. Create a Sentry account at https://sentry.io
2. Create a new project
3. Get your DSN
4. Add to `.env.local`:
   ```
   VITE_SENTRY_DSN=your_sentry_dsn_here
   ```
5. Initialize in `index.tsx`:
   ```typescript
   import { initErrorTracking } from './utils/monitoring';
   
   initErrorTracking();
   ```

## 5. Optional: Configure Feature Flags

Add to `.env.local` to enable/disable features:

```bash
# Experimental features
VITE_FEATURE_GEMINI_AI=true
VITE_FEATURE_ADVANCED_SEARCH=true
VITE_FEATURE_REALTIME_NOTIFICATIONS=true
VITE_FEATURE_ANALYTICS=false

# Performance features
VITE_FEATURE_SERVICE_WORKER=true
VITE_FEATURE_IMAGE_OPTIMIZATION=true

# UI features
VITE_FEATURE_DARK_MODE=false
VITE_FEATURE_COMMAND_PALETTE=true
```

## 6. Set Up GitHub Secrets (for CI/CD)

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `VERCEL_TOKEN` - Your Vercel API token (for preview deployments)
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

## 7. Test the Pre-commit Hook

Make a small change and try to commit:

```bash
git add .
git commit -m "test: verify pre-commit hook"
```

The hook should:
1. Run ESLint
2. Format code with Prettier
3. Only commit if everything passes

## 8. Verify Security

### Check for Secrets
```bash
# This should not find any secrets in code
grep -r "SUPABASE_SERVICE_ROLE_KEY" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .
```

### Run Security Tests
```bash
npm run test:e2e -- e2e/security.spec.ts
```

## 9. Build and Verify

```bash
npm run build
```

Check that:
- Build succeeds
- No console errors
- Bundle sizes are reasonable (check CI output)

## 10. Review Changes

Read `HARDENING_COMPLETE.md` for a complete summary of all changes.

## Troubleshooting

### Husky not working?
```bash
# Reinstall husky
rm -rf .husky
npx husky install
chmod +x .husky/pre-commit
```

### ESLint errors?
```bash
# Auto-fix what can be fixed
npm run lint:fix
```

### Prettier conflicts?
```bash
# Format all files
npm run format
```

### Tests failing?
- Make sure environment variables are set
- Check that Supabase is accessible
- Verify API server is running (for E2E tests)

## Next Steps

1. ✅ All dependencies installed
2. ✅ Husky initialized
3. ✅ Tests passing
4. ✅ CI/CD configured
5. ✅ Monitoring ready (optional)
6. ✅ Feature flags configured (optional)

Your codebase is now hardened and ready for production! 🎉


