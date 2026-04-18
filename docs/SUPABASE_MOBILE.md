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

  - `com.reride.app://oauth-callback` (**required for Android Google sign-in**) — without this, after Google approves you stay in Chrome on your **Site URL** (e.g. eride.co.in) and the WebView never gets a session.
  - `https://www.reride.co.in/**`
  - `https://reride.co.in/**` (if you still link apex)
  - `https://appassets.androidplatform.net/**` (Android WebView / WebViewAssetLoader)
  - `https://localhost/**` (Capacitor `androidScheme: https`)
  - `http://localhost:5173/**` (Vite dev)

On **web**, `getOAuthRedirectUrl()` uses **origin + pathname + search** (no hash). On **native Android** (Capacitor or bundled WebView), the app uses the deep link `com.reride.app://oauth-callback` for Google OAuth (PKCE) so Chrome Custom Tabs can hand control back to the app.

## 3b. Native Google Sign-In (Android / iOS)

When `VITE_GOOGLE_WEB_CLIENT_ID` is set in the **built** bundle (`npm run build:android` / CI), the app uses `@capawesome/capacitor-google-sign-in` and `signInWithIdToken` instead of Chrome Custom Tabs.

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**, keep your **Web application** OAuth client (used by Supabase). Copy its client ID into `VITE_GOOGLE_WEB_CLIENT_ID`.
2. Create an **Android** OAuth client: package name `com.reride.app`, SHA-1 from your debug keystore (`cd android && .\gradlew signingReport`) and release keystore if applicable.
3. Supabase → **Authentication** → **Providers** → **Google** → **Client IDs**: enter **comma-separated** values with the **Web** client ID first, then the **Android** client ID (and iOS client ID if you add iOS). Enable **Skip nonce check** if native sign-in fails with a nonce error (or configure nonce in the plugin per Supabase docs).
4. Rebuild the web bundle and sync: `npm run build:android && npx cap sync android`.

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
| **UnifiedLogin** email/password | ReRide API login → JWT. **`signInWithPassword` bridge is opt-in** (`VITE_SUPABASE_PASSWORD_BRIDGE=true`); only enable if API users exist in Supabase Auth with the same password. |
| **Seller `Login.tsx`** | Supabase email/password → `syncWithBackend` |
| **Google (web)** | `signInWithOAuth` → redirect in the same tab → `AppProvider` finishes with `syncWithBackend` |
| **Google (Android / iOS, recommended)** | If `VITE_GOOGLE_WEB_CLIENT_ID` is set: **native** Google Sign-In (`@capawesome/capacitor-google-sign-in`) → `signInWithIdToken` → no full-site Chrome tab. Requires Web + Android OAuth clients in Google Cloud and both IDs in Supabase Google provider. |
| **Google (Android fallback)** | If the env var is empty or native sign-in errors: `signInWithOAuth` opens **Chrome Custom Tab** → redirect `com.reride.app://oauth-callback` → `exchangeCodeForSession` |
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
4. **Ship new web code in the APK:** run `npm run android:bundle` (rebuilds `dist/` and syncs without a dev `server.url`). If the app still looks old, Android Studio → **Build → Clean Project**, then **Run** again so the WebView is not using a stale install.

## 10. Common issues

| Symptom | Likely cause |
|---------|----------------|
| CORS / “redirect not allowed for preflight” | Calling **`https://reride.co.in`** for API; use **`www`** (handled in `patchFetchForCapacitor` / `resolveApiUrl`). |
| Google “provider not enabled” | Google provider off or keys missing in Supabase. |
| AI / CSRF errors | Ensure API is `www`; `GEMINI_API_KEY` set on server for `/api/gemini`. |
| No Supabase features | `VITE_SUPABASE_*` missing in **built** bundle — rebuild mobile after env fix. |
| Chrome shows eride.co.in after Google; app not logged in | Add **`com.reride.app://oauth-callback`** to Supabase **Redirect URLs** (see §3). Otherwise Supabase sends users to your Site URL inside the Custom Tab. |
| “Why not 100% inside WebView?” | Google OAuth is **disallowed in embedded WebViews**; Custom Tab (or native Google Sign-In + `signInWithIdToken`) is required. |
| Android shows **old UI / old bugs** after you fixed the repo | WebView is loading a **remote** URL from a past `cap sync` with `RERIDE_VITE_DEV_SERVER_URL` set, or the native install was not rebuilt. Run **`npm run android:bundle`**, clean/rebuild in Android Studio, reinstall. |

---

*Last updated to match ReRide’s Capacitor + `apiConfig` + `AppProvider` OAuth/restore behavior.*
