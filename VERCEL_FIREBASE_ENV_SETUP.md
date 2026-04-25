# Vercel + Firebase-related environment variables

Do **not** commit real API keys, `google-services.json`, or service account JSON. Store values in **Vercel Environment Variables** (or another secret manager) and keep `.env.local` local only.

## Web (Vite on Vercel)

Typical client-safe names (see `env.example` for the full list used by this repo):

| Variable | Notes |
|----------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon** key only (not service_role) |
| `VITE_VAPID_PUBLIC_KEY` | Web Push / FCM VAPID **public** key if you use web push |

**Never** set `SUPABASE_SERVICE_ROLE_KEY` or any **Google/Firebase server** secrets as `VITE_*` — they would ship to the browser.

## Firebase / FCM (native Android)

- Add your Android app in [Firebase Console](https://console.firebase.google.com), download **`google-services.json`**, and place it under `android/app/` on your machine (that file should stay **out of git** if it contains project identifiers you treat as sensitive; many teams commit it — decide per your threat model).
- For **stub** behavior without `google-services.json`, see `MainActivity.java` (`ensureFirebaseInitialized`).

## Google API keys (Maps, Places, etc.)

- Create keys in [Google Cloud Console](https://console.cloud.google.com/) with **HTTP referrer** or **Android app** restrictions as appropriate.
- Set them in Vercel / native config — **not** in committed markdown or source literals.

## If a key was exposed

1. **Revoke / rotate** the key in Google Cloud or Firebase.
2. Update Vercel (and any other) env vars and redeploy.
3. Remove secrets from the repo tip and scrub git history if the leak was committed.
