import { Capacitor } from '@capacitor/core';
import { authenticatedFetch } from './authenticatedFetch';

let listenersInstalled = false;

/**
 * Register for FCM/APNs (Capacitor) and send token to API for server push.
 * Requires `push_device_tokens` table — see scripts/add-push-device-tokens.sql.
 */
export async function registerAndSyncNativePushToken(userEmail: string | undefined): Promise<void> {
  if (!userEmail?.trim() || !Capacitor.isNativePlatform()) return;
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
