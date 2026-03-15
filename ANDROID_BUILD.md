# ReRide – Run from Android Studio

The app is a **Capacitor** (Vite + React) project. The Play Store testing link serves a pre-built bundle; running from Android Studio uses a **local** build. Follow these steps so the app runs correctly from Android Studio.

---

## 1. Environment variables (required for local build)

The web bundle is built with Vite and bakes in `VITE_*` variables at build time. Without them, the app can show a white screen or fail to connect.

- If you don't have a `.env` file, copy the example and add your values:
  ```bash
  copy .env.example .env
  ```
  Or run: `npm run env:copy` (creates `.env` from `.env.example` only if `.env` doesn't exist).
- Edit `.env` and set at least:
  - `VITE_SUPABASE_URL` – your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` – your Supabase anon key  

Get these from [Supabase Dashboard](https://app.supabase.com) → your project → **Settings** → **API**.

---

## 2. Build the web app and sync to Android

**Always do this before running from Android Studio.** The Android app loads the built web assets from `dist`; if they're missing or stale, you get a white screen or old content.

From the **project root** (where `package.json` is):

```bash
npm run android
```

This will:

1. Build the web app for Capacitor (`build:android`).
2. Sync the build into the Android project (`cap sync android`).
3. Open the `android` folder in Android Studio.

Alternatively, run the steps separately:

```bash
npm run build:android
npx cap sync android
npx cap open android
```

---

## 3. In Android Studio

1. Wait for **Gradle sync** to finish (File → Sync Project with Gradle Files if needed).
2. Set **Gradle JDK** to **JDK 17**: File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK.
3. Select the **app** run configuration and a device or emulator (API 24+).
4. Click **Run**.

---

## Quick checklist

| Step | Action |
|------|--------|
| 1 | Have a `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| 2 | Run `npm run android` from the project root. |
| 3 | In Android Studio: Sync Gradle, set JDK 17, choose **app** and a device, then Run. |

---

## 4. Push notifications (optional)

To enable push notifications on Android:

1. **Firebase / Google Services**
   - Create a project in [Firebase Console](https://console.firebase.google.com) and add an Android app with package name `com.reride.app`.
   - Download `google-services.json` and place it in `android/app/`.
   - Without this file, the build still succeeds but push notifications will not work (the Gradle script skips applying the Google Services plugin).

2. **Web/PWA push (VAPID key)**
   - For web push (e.g. from your backend or PWA), set `VITE_VAPID_PUBLIC_KEY` in `.env` to your VAPID public key (from Firebase Cloud Messaging or Web Push).
   - Generate a key pair if needed: e.g. `npx web-push generate-vapid-keys`, then use the public key in `.env` and the private key on the server.

---

## If it still doesn't run

- **White screen:** Re-run `npm run android` so the latest web build is synced; then run again from Android Studio.
- **Gradle / build errors:** Ensure Android SDK is installed (including for compileSdk 36) and JDK 17 is selected.
- **App not installing:** Use a device or emulator with API 24 or higher.
