# Supabase environment setup

Do **not** paste real Supabase keys into this repository or any committed file. Use **local** env files and your host’s secret store (Vercel, GitHub Actions secrets, etc.).

## Local web / Vite

1. Copy `env.example` to `.env.local` (keep `.env.local` untracked; it is gitignored).
2. From [Supabase Dashboard](https://supabase.com/dashboard) → **Project Settings** → **API**:
   - **Project URL** → `VITE_SUPABASE_URL` (and optionally `SUPABASE_URL` for server tooling).
   - **anon public** key → `VITE_SUPABASE_ANON_KEY` (client-safe).
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` **only** in server-side / CI secrets — never in the browser bundle or mobile app assets.

3. Restart the dev server after changing env vars.

## Production (example: Vercel)

Set the same variables in the project **Environment Variables** UI for each environment (Production / Preview). Use **secrets** for `SUPABASE_SERVICE_ROLE_KEY`.

## Rotation

If a service_role or anon key was ever committed or exposed:

1. In Supabase Dashboard → **Project Settings** → **API**, rotate the affected key.
2. Update all deployment secrets and local `.env.local`.
3. Optionally rewrite git history to remove old blobs (e.g. `git filter-repo`); alerts may persist until history is cleaned.

## Further reading

- `env.example` — variable names and short comments.
- `docs/SUPABASE_MOBILE.md` — mobile-specific notes.
