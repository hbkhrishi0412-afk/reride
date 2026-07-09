#!/usr/bin/env node
/**
 * Prints a concise Vercel environment checklist for this project.
 * Does not read secrets; run in terminal before/after editing Vercel → Settings → Environment variables.
 */
const text = `
ReRide — Vercel "Needs Attention" quick fix
===========================================

1) For EVERY variable flagged, open it and either:
   - Paste a real current value, then save; or
   - Delete the variable if your deployment does not use it (stops empty-value warnings).

2) Mark all API keys and JWT as Sensitive. Redeploy Production after changes.

3) Required in Production (serverless /api and SPA build):
   - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   - SUPABASE_URL, SUPABASE_ANON_KEY (match the VITE_* values)
   - SUPABASE_SERVICE_ROLE_KEY  (from Supabase → Settings → API → service_role)
   - JWT_SECRET                 (long random; openssl rand -base64 48)
   - ALLOWED_ORIGINS            (e.g. https://www.reride.co.in,https://reride.co.in)
   - UPSTASH_REDIS_REST_URL     (distributed rate limiting + token revocation in production)
   - UPSTASH_REDIS_REST_TOKEN
   - SUPABASE_RLS_PRODUCTION_VERIFIED=true  (set only after SQL rollout + policy verification)
   - VITE_SENTRY_DSN            (client error tracking; add https://*.ingest.sentry.io to CSP — already in vercel.json)

4) Google Sign-In is configured in Supabase Auth → Providers → Google and Google Cloud
   OAuth, not as GOOGLE_CLIENT_ID in Vercel (unless you add custom tooling).

5) Optional — enable live pricing sources:
   - SUREPASS_API_TOKEN           (Surepass IDV / vehicle price APIs — recommended)
   - SUREPASS_API_BASE_URL       (default https://kyc-api.surepass.io)
   - SUREPASS_IDV_PATH           (from Surepass dashboard docs)
   - SUREPASS_VEHICLE_PRICE_PATH (from Surepass dashboard docs)
   - SUREPASS_RC_TO_IDV_PATH     (optional, when RC number is available)
   - GEMINI_API_KEY              (live web market search fallback)
   - IBB_API_BASE_URL / IBB_API_KEY (Indian Blue Book enterprise API)

6) Optional cleanup — remove if unused, to clear dashboard noise:
   - MONGODB_URL / MONGODB_URI   (this app’s Vercel API uses Supabase, not Mongo)
   - OBSERVE_AUTONOMA_*          (not referenced in this repository)

7) After rotating or fixing secrets, trigger a new Production deployment.

Details: see .env.example (section "Vercel → Project → Settings…").
`.trim();
console.log(text);
