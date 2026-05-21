# Fix Vercel: "Provisioning integrations failed" (Re-ride / Supabase)

Deployments that fail in **~1 second** with **Build Failed: Provisioning integrations failed** never reach `npm run build`. This is a **Vercel ↔ Supabase integration** issue, not an application compile error.

## Quick fix (recommended)

1. **Vercel** → project **reride-2** → **Settings** → **Integrations**
2. Open **Re-ride** (Supabase) → **Remove** or **Disconnect**
3. **Add integration** → [Supabase](https://vercel.com/integrations/supabase)
4. Choose **Connect existing project** (not “create new”) → select **`pqtrsoytudolnvuydvfo`**
5. **Settings** → **Environment Variables** → resolve any **Needs attention** (orange badge):
   - `SUPABASE_URL` = `https://pqtrsoytudolnvuydvfo.supabase.co`
   - `SUPABASE_ANON_KEY` = anon key from Supabase → Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (secret)
   - `VITE_SUPABASE_URL` = same as `SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` = same as `SUPABASE_ANON_KEY`
   - `JWT_SECRET` = long random string (`openssl rand -base64 48`)
   - `ALLOWED_ORIGINS` = `https://www.reride.co.in,https://reride.co.in`
6. **Deployments** → **Redeploy** latest Production deployment

## Without the integration (manual env only)

1. Remove the Supabase integration entirely
2. Set all variables in step 5 manually for **Production** and **Preview**
3. Redeploy

The app does **not** require the integration if env vars are set correctly.

## What this repo adds

- `supabase/config.toml` — links project ref `pqtrsoytudolnvuydvfo` for CLI/integration
- `npm run build:vercel` — maps `SUPABASE_*` → `VITE_SUPABASE_*` before Vite build
- `vercel.json` uses `build:vercel` so Production builds get correct client env

## Verify after deploy

```bash
npm run vercel:env-checklist
curl -s https://www.reride.co.in/api/health
```

Build logs should show **Building** for more than a few seconds, not only "Provisioning integrations".
