import type { Notification } from '../types';

/** Generic copy only — no user email or free-text body (CodeQL: clear-text storage). */
function safePersistedMessage(n: Notification): string {
  if (n.type === 'service_request_status') {
    return 'Service request update';
  }
  if (n.targetType === 'price_drop' || n.type === 'price_drop') {
    return 'Price drop alert';
  }
  if (n.targetType === 'conversation') {
    return 'Conversation update';
  }
  if (n.targetType === 'vehicle') {
    return 'Listing update';
  }
  return 'Notification';
}

function safePersistedTitle(n: Notification): string | undefined {
  if (n.title === 'Price drop' || n.title === 'Service Request Update') {
    return n.title;
  }
  return undefined;
}

/**
 * Shape safe for localStorage: no recipient email and no original message/title text.
 */
export function notificationsForLocalStorage(list: Notification[]): Notification[] {
  return list.map((n) => ({
    id: n.id,
    recipientEmail: '',
    message: safePersistedMessage(n),
    title: safePersistedTitle(n),
    targetId: n.targetId,
    vehicleId: n.vehicleId,
    targetType: n.targetType,
    type: n.type,
    isRead: n.isRead,
    timestamp: n.timestamp,
  }));
}

const NOTIFICATIONS_KEY_V2 = 'reRideNotificationsV2';
const NOTIFICATIONS_KEY_LEGACY = 'reRideNotifications';

/**
 * Sanitized list only in sessionStorage (shorter lived than localStorage; avoids long-lived clear-text PII on disk).
 */
export function persistReRideNotifications(list: Notification[]): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const safe = notificationsForLocalStorage(list);
    sessionStorage.setItem(NOTIFICATIONS_KEY_V2, JSON.stringify(safe));
    try {
      localStorage.removeItem(NOTIFICATIONS_KEY_LEGACY);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedReRideNotifications(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem(NOTIFICATIONS_KEY_V2);
      if (s) return s;
    }
    if (typeof localStorage !== 'undefined') {
      const l = localStorage.getItem(NOTIFICATIONS_KEY_LEGACY);
      if (l) {
        try {
          if (typeof sessionStorage !== 'undefined') {
            const n = JSON.parse(l) as Notification[];
            sessionStorage.setItem(
              NOTIFICATIONS_KEY_V2,
              JSON.stringify(notificationsForLocalStorage(n))
            );
            localStorage.removeItem(NOTIFICATIONS_KEY_LEGACY);
            return sessionStorage.getItem(NOTIFICATIONS_KEY_V2);
          }
        } catch {
          return l;
        }
        return l;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
