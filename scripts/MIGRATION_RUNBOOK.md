# Supabase Migration Runbook

Apply in order for production readiness.

## 1. Base schema (new projects only)

1. `scripts/complete-supabase-schema.sql`
2. All files in `scripts/migrations/` **except** duplicates — use chronological order by filename prefix.

## 2. Production RLS (required before launch)

1. `scripts/enable-rls-production.sql`
2. `scripts/migrations/add-deal-platform-rls-policies.sql`
3. `scripts/migrations/add-support-chat-tables.sql`
4. `scripts/migrations/fix-users-rls-recursion.sql`
5. `scripts/migrations/fix-users-rls-anon-access.sql` — **re-run if you applied enable-rls-production.sql after this**
6. `scripts/migrations/fix-revoke-users-password.sql` — REVOKE ALL first, then column revoke
7. `scripts/migrations/fix-security-kv-rpc-grants.sql` — lock `security_kv_*` RPC to `service_role` only

**One-shot SQL Editor paste:** `scripts/migrations/fix-launch-security-grants.sql` (steps 6 + 7 combined)

Or CLI (requires `DATABASE_URL` in `.env.local`):

```bash
npm run db:apply-launch-grants
npm run db:verify-password-revoke
npm run verify:supabase-security-kv
```

Copies also live under `supabase/migrations/` for Supabase CLI workflows.

Optional geo search:

- `scripts/migrations/add-support-chat-and-postgis.sql` (includes PostGIS + support chat if not using step 3)

## 3. Apply via CLI (recommended)

```bash
# Set DATABASE_URL from Supabase → Settings → Database → URI
node scripts/apply-production-migrations.cjs
```

Or paste each SQL file into **Supabase Dashboard → SQL Editor**.

## 4. Post-migration checklist

- [ ] Enable **Leaked Password Protection** (Auth → Policies)
- [ ] Set `SUPABASE_RLS_PRODUCTION_VERIFIED=true` in Vercel
- [ ] Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- [ ] Run `npm run verify:production-security`
- [ ] Run `npm run generate:sitemap` (or deploy — runs on `build:vercel`)

## 5. Verify

```bash
npm run db:verify
npm run verify:production-security
```

Supabase Dashboard → Database → Advisors — resolve remaining security lints.
