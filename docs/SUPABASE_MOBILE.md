# Supabase + ReRide mobile (Capacitor) checklist

Use this when wiring **Supabase Auth**, **Realtime**, and the **ReRide API** for the Android/iOS WebView build (`appassets.androidplatform.net` or `https://localhost`).

## 1. Environment variables (client bundle)

Set in `.env.production` (or CI/Vercel build env) so Vite embeds them in the app:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project **anon** key (Dashboard → Project Settings → API) |

After changing these:

```bash
npm run build:android
npx cap sync android
```

Rebuild the app in Android Studio. Missing values → the app uses a **stub** Supabase client (no real auth/realtime).

## 2. Environment variables (API / Vercel)

Serverless handlers need database access:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Same URL as above (often duplicated from `VITE_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (secret; never ship to the client) |
| `SUPABASE_ANON_KEY` | Optional; some code paths accept `VITE_SUPABASE_ANON_KEY` |

Redeploy after changes.

## 3. Supabase → URL configuration

**Authentication → URL Configuration**

- **Site URL:** your canonical web origin, e.g. `https://www.reride.co.in`
- **Redirect URLs** (add every origin the app uses):

  - `https://www.reride.co.in/**`
  - `https://reride.co.in/**` (if you still link apex)
  - `https://appassets.androidplatform.net/**` (Android WebView / WebViewAssetLoader)
  - `https://localhost/**` (Capacitor `androidScheme: https`)
  - `http://localhost:5173/**` (Vite dev)

`getOAuthRedirectUrl()` in the app uses **origin + pathname + search** (no hash). Your return URL after Google OAuth must match an allowed pattern.

## 4. Supabase → Auth providers

- **Email:** enabled by default; align signup/login with your ReRide API users if you use hybrid login.
- **Google:** Authentication → Providers → **Google** — enable, set Web client ID + secret from Google Cloud Console.
- **Phone (OTP):** enable only if Twilio/MessageBird (or your SMS provider) is configured in Supabase.

If Google returns “provider is not enabled”, the provider is off or misconfigured in the dashboard, not in this repo.

## 5. API origin and CORS (mobile)

The app resolves `/api/*` to **`https://www.reride.co.in`** in native WebView (see `utils/apiConfig.ts`) so **OPTIONS** preflight is not broken by apex → `www` redirects.

- Prefer **`www`** in `VITE_API_URL` / `VITE_PRODUCTION_ORIGIN` if you set overrides.
- Server CORS must allow `https://appassets.androidplatform.net` and `https://localhost` (already listed in `utils/security-config.ts` and `api/main.ts` patterns).

## 6. Auth flows in the app

| Flow | Behavior |
|------|----------|
| **UnifiedLogin** email/password | ReRide API login → JWT + optional **Supabase `signInWithPassword`** bridge for same credentials |
| **Seller `Login.tsx`** | Supabase email/password → `syncWithBackend` |
| **Google** | `signInWithOAuth` → full-page redirect → `AppProvider` finishes with `syncWithBackend` |
| **Session restore** | If ReRide user is missing but Supabase session exists → `syncWithBackend` once (see `AppProvider`) |

Logout clears ReRide tokens, `reride_oauth_role`, `reride_last_role`, and calls `supabase.auth.signOut()`.

## 7. Routing in the WebView

Native shell uses **HashRouter** (`index.tsx`) so paths like `/used-cars` are not requested as missing static files. Deep links still need your redirect URLs to land on a valid document (e.g. `index.html`).

## 8. Realtime and RLS

- Realtime uses the **anon** client + user JWT from storage (`utils/authStorage.ts` also reads Supabase session keys).
- If RLS policies use `auth.uid()`, the user must have a valid **Supabase Auth** session (bridge + OAuth/email flows above).

## 9. Quick verification

1. Web: open site, sign in, confirm Network calls to `*.supabase.co` succeed.
2. Android: install debug build, sign in, cold-kill app, reopen — user should restore from storage or Supabase session resync.
3. Google: complete OAuth; you should return to the app and land logged in after `syncWithBackend`.

## 10. Common issues

| Symptom | Likely cause |
|---------|----------------|
| CORS / “redirect not allowed for preflight” | Calling **`https://reride.co.in`** for API; use **`www`** (handled in `patchFetchForCapacitor` / `resolveApiUrl`). |
| Google “provider not enabled” | Google provider off or keys missing in Supabase. |
| AI / CSRF errors | Ensure API is `www`; `GEMINI_API_KEY` set on server for `/api/gemini`. |
| No Supabase features | `VITE_SUPABASE_*` missing in **built** bundle — rebuild mobile after env fix. |

---

*Last updated to match ReRide’s Capacitor + `apiConfig` + `AppProvider` OAuth/restore behavior.*
