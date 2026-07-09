/**
 * Mobile Push Notification Manager
 * Handles push notification subscription and display
 */

import React, { useEffect, useRef } from 'react';
import { usePushNotifications, useAppBadge } from '../hooks/useMobileFeatures';
import type { Notification } from '../types';
import { getEffectiveMuteKeys, isStoryMuted } from '../utils/notificationMute';
import { buildNotificationDeepLinkUrl } from '../utils/notificationDeepLink';

interface MobilePushNotificationManagerProps {
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  /** When set (including `[]`), mutes follow the logged-in profile; otherwise localStorage. */
  profileMuteKeys?: string[];
}

export const MobilePushNotificationManager: React.FC<MobilePushNotificationManagerProps> = ({
  notifications,
  onNotificationClick,
  profileMuteKeys,
}) => {
  const { permission, subscribe, isSubscribed, notify } = usePushNotifications();
  const { updateBadge } = useAppBadge();
  /** Avoid re-firing local notifications when the parent passes a new `notifications` array reference. */
  const shownLocalNotificationIdsRef = useRef<Set<number>>(new Set());

  // Update app badge with unread notification count
  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    updateBadge(unreadCount);
  }, [notifications, updateBadge]);

  // Request permission and subscribe on mount
  useEffect(() => {
    if (permission === 'default' && !isSubscribed) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        subscribe();
      }
    }
  }, [permission, isSubscribed, subscribe]);

  // Show local notification once per unread id (stable across re-renders / refetches)
  useEffect(() => {
    if (permission !== 'granted') return;

    const validIds = new Set(notifications.map((n) => n.id));
    if (shownLocalNotificationIdsRef.current.size > 100) {
      shownLocalNotificationIdsRef.current = new Set(
        [...shownLocalNotificationIdsRef.current].filter((id) => validIds.has(id))
      );
    }

    const muted = getEffectiveMuteKeys(profileMuteKeys);
    const unreadNew = notifications
      .filter((n) => !n.isRead && !shownLocalNotificationIdsRef.current.has(n.id))
      .filter((n) => !isStoryMuted(n, muted))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    for (const n of unreadNew) {
      shownLocalNotificationIdsRef.current.add(n.id);
      void notify({
        title: n.title || 'ReRide',
        body: n.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `notification-${n.id}`,
        data: {
          notificationId: n.id,
          url: getNotificationUrl(n),
          leadId: n.dealLeadId,
          action: n.dealAction,
          conversationId: n.conversationId,
          type: n.targetType === 'deal' ? 'deal' : undefined,
        },
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });
    }
  }, [notifications, permission, notify, profileMuteKeys]);

  // Handle notification clicks from service worker
  useEffect(() => {
    const handleNotificationClick = (event: MessageEvent) => {
      const d = event.data;
      if (!d || d.type !== 'NOTIFICATION_CLICK') return;
      const notificationId = d.notificationId;
      // Defer navigation / state updates off the SW message task (avoids long "message" handler violations).
      queueMicrotask(() => {
        if (d.pushType === 'deal' && d.leadId && d.action === 'accept_chat') {
          window.dispatchEvent(
            new CustomEvent('reride:native-push-tap', {
              detail: {
                type: 'deal',
                leadId: d.leadId,
                action: d.action,
                conversationId: d.conversationId,
              },
            }),
          );
          return;
        }
        if (d.pushType === 'deal' && d.leadId && d.action === 'view_assistance') {
          window.dispatchEvent(
            new CustomEvent('reride:native-push-tap', {
              detail: {
                type: 'deal',
                leadId: d.leadId,
                action: d.action,
              },
            }),
          );
          return;
        }
        const notification = notifications.find((n) => n.id === notificationId);
        if (notification && onNotificationClick) {
          onNotificationClick(notification);
        }
      });
    };

    navigator.serviceWorker?.addEventListener('message', handleNotificationClick);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleNotificationClick);
    };
  }, [notifications, onNotificationClick]);

  return null; // This component doesn't render anything
};

function getNotificationUrl(notification: Notification): string {
  return buildNotificationDeepLinkUrl(notification);
}

export default MobilePushNotificationManager;








































