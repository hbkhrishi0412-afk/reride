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

4) Google Sign-In is configured in Supabase Auth → Providers → Google and Google Cloud
   OAuth, not as GOOGLE_CLIENT_ID in Vercel (unless you add custom tooling).

5) Optional cleanup — remove if unused, to clear dashboard noise:
   - MONGODB_URL / MONGODB_URI   (this app’s Vercel API uses Supabase, not Mongo)
   - GEMINI_API_KEY              (only if you do not use Gemini on the server)
   - OBSERVE_AUTONOMA_*          (not referenced in this repository)

6) After rotating or fixing secrets, trigger a new Production deployment.

Details: see .env.example (section "Vercel → Project → Settings…").
`.trim();
console.log(text);
