/**
 * Mobile Push Notification Manager
 * Handles push notification subscription and display
 */

import React, { useEffect } from 'react';
import { usePushNotifications, useAppBadge } from '../hooks/useMobileFeatures';
import type { Notification } from '../types';

interface MobilePushNotificationManagerProps {
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
}

export const MobilePushNotificationManager: React.FC<MobilePushNotificationManagerProps> = ({
  notifications,
  onNotificationClick
}) => {
  const { permission, subscribe, unsubscribe, isSubscribed, notify } = usePushNotifications();
  const { updateBadge } = useAppBadge();

  // Update app badge with unread notification count
  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    updateBadge(unreadCount);
  }, [notifications, updateBadge]);

  // Request permission and subscribe on mount
  useEffect(() => {
    if (permission === 'default' && !isSubscribed) {
      // Auto-subscribe if permission is granted
      if (Notification.permission === 'granted') {
        subscribe();
      }
    }
  }, [permission, isSubscribed, subscribe]);

  // Show local notification for new notifications
  useEffect(() => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length > 0 && permission === 'granted') {
      const latestNotification = unreadNotifications[unreadNotifications.length - 1];
      
      notify({
        title: latestNotification.title || 'ReRide',
        body: latestNotification.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `notification-${latestNotification.id}`,
        data: {
          notificationId: latestNotification.id,
          url: getNotificationUrl(latestNotification),
          view: getNotificationView(latestNotification)
        },
        requireInteraction: false,
        vibrate: [200, 100, 200]
      });
    }
  }, [notifications, permission, notify]);

  // Handle notification clicks from service worker
  useEffect(() => {
    const handleNotificationClick = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const notificationId = event.data.notificationId;
        const notification = notifications.find(n => n.id === notificationId);
        if (notification && onNotificationClick) {
          onNotificationClick(notification);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleNotificationClick);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleNotificationClick);
    };
  }, [notifications, onNotificationClick]);

  return null; // This component doesn't render anything
};

// Helper functions
function getNotificationUrl(notification: Notification): string {
  if (notification.vehicleId) {
    return `/?view=DETAIL&id=${notification.vehicleId}`;
  }
  if (notification.type === 'message') {
    return `/?view=INBOX`;
  }
  if (notification.type === 'wishlist' || notification.type === 'price_drop') {
    return `/?view=WISHLIST`;
  }
  return '/';
}

function getNotificationView(notification: Notification): string {
  if (notification.vehicleId) {
    return 'DETAIL';
  }
  if (notification.type === 'message') {
    return 'INBOX';
  }
  if (notification.type === 'wishlist' || notification.type === 'price_drop') {
    return 'WISHLIST';
  }
  return 'HOME';
}

export default MobilePushNotificationManager;

















