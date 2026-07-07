/** Normalized payload from Capacitor FCM/APNs `data` (values are often strings). */
export type NativePushPayload = {
  url?: string;
  vehicleId?: number;
  notificationId?: number;
  view?: string;
  targetType?: string;
  targetId?: string | number;
  type?: string;
  leadId?: string;
  action?: string;
  conversationId?: string;
};

function readField(raw: Record<string, unknown>, key: string): string | undefined {
  const v = raw[key] ?? raw[key.toLowerCase()];
  if (v == null || v === '') return undefined;
  return typeof v === 'string' ? v : String(v);
}

export function normalizeNativePushPayload(
  raw: Record<string, unknown> | undefined | null,
): NativePushPayload {
  if (!raw || typeof raw !== 'object') return {};

  const url = readField(raw, 'url');
  const view = readField(raw, 'view');
  const type = readField(raw, 'type');
  const targetType = readField(raw, 'targetType');
  const targetIdRaw = readField(raw, 'targetId');
  const vehicleIdRaw = readField(raw, 'vehicleId');
  const notificationIdRaw = readField(raw, 'notificationId');
  const leadId = readField(raw, 'leadId');
  const action = readField(raw, 'action');
  const conversationId = readField(raw, 'conversationId');

  const vehicleId =
    vehicleIdRaw != null && !Number.isNaN(Number(vehicleIdRaw))
      ? Number(vehicleIdRaw)
      : undefined;
  const notificationId =
    notificationIdRaw != null && !Number.isNaN(Number(notificationIdRaw))
      ? Number(notificationIdRaw)
      : undefined;

  return {
    url,
    view,
    type,
    targetType,
    targetId: targetIdRaw,
    vehicleId,
    notificationId,
    leadId,
    action,
    conversationId,
  };
}

/** Apply a hash or legacy query deep link in the WebView. */
export function applyNotificationDeepLinkUrl(url: string): void {
  if (typeof window === 'undefined' || !url) return;

  if (url.includes('#')) {
    const hash = url.slice(url.indexOf('#') + 1).replace(/^\/?/, '');
    window.location.hash = hash.startsWith('/') ? hash : `/${hash}`;
    return;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    const view = parsed.searchParams.get('view');
    const id = parsed.searchParams.get('id');
    if (view?.toUpperCase() === 'DETAIL' && id) {
      window.location.hash = `/vehicle/${id}`;
      return;
    }
    if (view?.toUpperCase() === 'INBOX') {
      window.location.hash = '/inbox';
      return;
    }
    if (view?.toUpperCase() === 'WISHLIST') {
      window.location.hash = '/wishlist';
      return;
    }
  } catch {
    /* ignore */
  }

  window.location.hash = '/';
}
