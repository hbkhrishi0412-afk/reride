import type { Notification } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Save notification to MongoDB
 */
export async function saveNotificationToMongoDB(notification: Notification): Promise<{ success: boolean; data?: Notification; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to save notification' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error saving notification to MongoDB:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get notifications from MongoDB
 */
export async function getNotificationsFromMongoDB(recipientEmail?: string, isRead?: boolean): Promise<{ success: boolean; data?: Notification[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (recipientEmail) params.append('recipientEmail', recipientEmail);
    if (isRead !== undefined) params.append('isRead', String(isRead));

    // Only add query string if there are params
    const queryString = params.toString();
    const url = queryString 
      ? `${API_BASE_URL}/notifications?${queryString}`
      : `${API_BASE_URL}/notifications`;

    const response = await fetch(url);

    // Handle 404 gracefully - silently fall back (expected in dev)
    if (response.status === 404) {
      return { success: false, error: 'API route not available' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to get notifications' };
    }

    const result = await response.json();
    return { success: true, data: result.data || [] };
  } catch (error) {
    // Network errors - gracefully fall back
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return { success: false, error: 'Network error - API unavailable' };
    }
    console.error('Error getting notifications from MongoDB:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update notification in MongoDB (e.g., mark as read)
 */
export async function updateNotificationInMongoDB(notificationId: number, updates: Partial<Notification>): Promise<{ success: boolean; data?: Notification; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationId, updates }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to update notification' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error updating notification in MongoDB:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Keep the existing browser notification functions
/**
 * Checks for notification permission and requests it if necessary.
 * @returns Promise<boolean> - true if permission is granted, false otherwise.
 */
const checkAndRequestPermission = async (): Promise<boolean> => {
    // Check if the browser supports notifications
    if (!('Notification' in window)) {
        console.warn("This browser does not support desktop notification.");
        return false;
    }

    // Check if permission is already granted
    if (Notification.permission === 'granted') {
        return true;
    }

    // If permission has not been denied, ask for it
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    // Permission is denied
    return false;
};

/**
 * Shows a browser notification if permissions are granted and the tab is not active.
 * @param title The title of the notification.
 * @param options The options for the notification (e.g., body, icon).
 */
export const showNotification = async (title: string, options: NotificationOptions) => {
    // Only proceed if the page is hidden from view
    if (document.visibilityState !== 'hidden') {
        return;
    }

    const hasPermission = await checkAndRequestPermission();

    if (hasPermission) {
        // Create and display the notification
        new Notification(title, options);
    }
};
