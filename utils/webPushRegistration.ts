import { isCapacitorNativeApp } from './isCapacitorNative.js';
import { authenticatedFetch } from './authenticatedFetch.js';
import {
  getPushSubscription,
  requestNotificationPermission,
  subscribeToPushNotifications,
} from './mobileFeatures.js';

/**
 * Persist the browser Push API subscription so the server can notify sellers when the tab is closed.
 */
export async function syncWebPushSubscription(userEmail: string | undefined): Promise<boolean> {
  if (!userEmail?.trim() || typeof window === 'undefined' || isCapacitorNativeApp()) {
    return false;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return false;

  let subscription = await getPushSubscription();
  if (!subscription) {
    subscription = await subscribeToPushNotifications();
  }
  if (!subscription) return false;

  const json = subscription.toJSON();
  if (!json.endpoint) return false;

  try {
    const response = await authenticatedFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save-web-push-subscription',
        subscription: json,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
