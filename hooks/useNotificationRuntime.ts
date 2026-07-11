import { useEffect, useState } from 'react';
import type { Notification } from '../types';
import { persistReRideNotifications, readPersistedReRideNotifications } from '../utils/notificationLocalStorage';

function readInitialNotifications(): Notification[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const notificationsJson = readPersistedReRideNotifications();
    if (notificationsJson) return JSON.parse(notificationsJson);
    if (import.meta.env.DEV) {
      const sampleNotifications: Notification[] = [
        {
          id: 1,
          recipientEmail: 'seller@test.com',
          message: 'New message from Mock Customer: Offer: 600000',
          targetId: 'conv_1703123456789',
          targetType: 'conversation',
          isRead: false,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 2,
          recipientEmail: 'seller@test.com',
          message: 'New message from Mock Customer: Offer: 123444',
          targetId: 'conv_1703123456789',
          targetType: 'conversation',
          isRead: false,
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        },
      ];
      try {
        persistReRideNotifications(sampleNotifications);
      } catch {
        /* WebView may restrict setItem */
      }
      return sampleNotifications;
    }
    return [];
  } catch {
    return [];
  }
}

/** Notification list state + guest-session cleanup (extracted from AppProvider). */
export function useNotificationRuntime(currentUserEmail: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>(readInitialNotifications);

  useEffect(() => {
    if (currentUserEmail) return;
    if (import.meta.env.DEV) return;
    setNotifications([]);
    try {
      persistReRideNotifications([]);
    } catch {
      /* ignore */
    }
  }, [currentUserEmail]);

  return { notifications, setNotifications };
}
