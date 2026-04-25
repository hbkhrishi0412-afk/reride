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

export function persistReRideNotifications(list: Notification[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('reRideNotifications', JSON.stringify(notificationsForLocalStorage(list)));
  } catch {
    /* ignore quota / private mode */
  }
}
