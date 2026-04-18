import { Capacitor } from '@capacitor/core';
import { authenticatedFetch } from './authenticatedFetch';

let listenersInstalled = false;

/**
 * Whether `PushNotifications.register()` is safe to invoke on the current
 * native platform. iOS uses APNs and does not require Firebase. Android, on
 * the other hand, calls `FirebaseMessaging.getInstance()` inside the
 * Capacitor plugin's `register()` method — if Firebase isn't initialized
 * (i.e. `android/app/google-services.json` is missing or the
 * `com.google.gms.google-services` Gradle plugin wasn't applied), that call
 * throws `IllegalStateException` on the `CapacitorPlugins` handler thread
 * and Capacitor rethrows it as a fatal `RuntimeException` that kills the
 * process. A JS-side try/catch cannot rescue it.
 *
 * To enable Android push:
 *   1. Place a valid `google-services.json` at `android/app/google-services.json`.
 *   2. Set `VITE_ANDROID_PUSH_ENABLED=true` in your env before the web build.
 *   3. Run `npx cap sync android` and rebuild the APK.
 */
function isNativePushSafe(): boolean {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return true;
  if (platform === 'android') {
    return (import.meta as any)?.env?.VITE_ANDROID_PUSH_ENABLED === 'true';
  }
  return false;
}

/**
 * Register for FCM/APNs (Capacitor) and send token to API for server push.
 * Requires `push_device_tokens` table — see scripts/add-push-device-tokens.sql.
 */
export async function registerAndSyncNativePushToken(userEmail: string | undefined): Promise<void> {
  if (!userEmail?.trim() || !Capacitor.isNativePlatform()) return;
  if (!isNativePushSafe()) {
    if (Capacitor.getPlatform() === 'android') {
      console.info(
        '[ReRide] Android push notifications skipped: Firebase is not configured. ' +
          'Add android/app/google-services.json and set VITE_ANDROID_PUSH_ENABLED=true to enable.'
      );
    }
    return;
  }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;

    if (!listenersInstalled) {
      listenersInstalled = true;
      await PushNotifications.addListener('registration', async (t) => {
        const token = t.value;
        if (!token) return;
        try {
          await authenticatedFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify({
              action: 'save-push-token',
              token,
              platform: Capacitor.getPlatform(),
            }),
          });
        } catch {
          /* table may be missing */
        }
      });
      void PushNotifications.addListener('registrationError', (e) => {
        console.warn('[ReRide] Push registration error:', e.error);
      });
    }

    await PushNotifications.register();
  } catch (e) {
    console.warn('[ReRide] Native push not available:', e);
  }
}
