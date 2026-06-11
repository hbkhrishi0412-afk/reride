import type { Notification } from '../types.js';

/**
 * Hash-route deep links for HashRouter / Capacitor WebView.
 * Query-string `/?view=DETAIL&id=` is legacy and unreliable on packaged Android.
 */
export function buildNotificationDeepLinkPath(notification: Notification): string {
  if (notification.targetType === 'conversation') {
    return '/inbox';
  }
  if (notification.vehicleId != null && !Number.isNaN(notification.vehicleId)) {
    return `/vehicle/${notification.vehicleId}`;
  }
  const rawVid =
    notification.targetType === 'vehicle' || notification.targetType === 'price_drop'
      ? notification.targetId
      : undefined;
  if (rawVid != null && rawVid !== '' && !Number.isNaN(Number(rawVid))) {
    return `/vehicle/${rawVid}`;
  }
  if (notification.type === 'message') {
    return '/inbox';
  }
  if (
    notification.targetType === 'price_drop' ||
    notification.type === 'wishlist' ||
    notification.type === 'price_drop'
  ) {
    return '/wishlist';
  }
  if (notification.targetType === 'insurance_expiry') {
    return '/profile';
  }
  return '/';
}

/** Full in-app URL including hash prefix (e.g. `/#/vehicle/42`). */
export function buildNotificationDeepLinkUrl(notification: Notification): string {
  const path = buildNotificationDeepLinkPath(notification);
  return path === '/' ? '/#/' : `/#${path}`;
}
