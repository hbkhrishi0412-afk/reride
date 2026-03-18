import type { Notification } from '../types';
import { queueRequest } from '../utils/requestQueue';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

/**
 * Save notification to Supabase
 */
export async function saveNotificationToSupabase(notification: Notification): Promise<{ success: boolean; data?: Notification; error?: string }> {
  try {
    const response = await authenticatedFetch('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(notification),
    });

    const result = await handleApiResponse<{ data?: Notification; reason?: string; error?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || 'Failed to save notification' };
    }
    return { success: true, data: result.data?.data };
  } catch (error) {
    console.error('Error saving notification to Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get notifications from Supabase
 */
export async function getNotificationsFromSupabase(recipientEmail?: string, isRead?: boolean): Promise<{ success: boolean; data?: Notification[]; error?: string }> {
  try {
    const result = await queueRequest(
      async () => {
        const params = new URLSearchParams();
        if (recipientEmail) params.append('recipientEmail', recipientEmail);
        if (isRead !== undefined) params.append('isRead', String(isRead));

        // Only add query string if there are params
        const queryString = params.toString();
        const url = queryString 
          ? `/api/notifications?${queryString}`
          : `/api/notifications`;

        const response = await authenticatedFetch(url);

        // Handle 404 gracefully - silently fall back (expected in dev)
        if (response.status === 404) {
          return { success: false, error: 'API route not available' };
        }

        const parsed = await handleApiResponse<{ data?: Notification[]; reason?: string; error?: string }>(response);
        if (!parsed.success) {
          return { success: false, error: parsed.reason || parsed.error || 'Failed to get notifications' };
        }
        return { success: true, data: parsed.data?.data || [] };
      },
      { priority: 5, id: 'notifications', maxRetries: 2 }
    );
    
    return result;
  } catch (error) {
    // Network errors - gracefully fall back
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return { success: false, error: 'Network error - API unavailable' };
    }
    console.error('Error getting notifications from Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update notification in Supabase (e.g., mark as read)
 */
export async function updateNotificationInSupabase(notificationId: number, updates: Partial<Notification>): Promise<{ success: boolean; data?: Notification; error?: string }> {
  try {
    const response = await authenticatedFetch('/api/notifications', {
      method: 'PUT',
      body: JSON.stringify({ notificationId, updates }),
    });

    const result = await handleApiResponse<{ data?: Notification; reason?: string; error?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || 'Failed to update notification' };
    }
    return { success: true, data: result.data?.data };
  } catch (error) {
    console.error('Error updating notification in Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Backward compatibility aliases
export const saveNotificationToMongoDB = saveNotificationToSupabase;
export const getNotificationsFromMongoDB = getNotificationsFromSupabase;
export const updateNotificationInMongoDB = updateNotificationInSupabase;

// Keep the existing browser notification functions
/**
 * Checks for notification permission and requests it if necessary.
 * @returns Promise<boolean> - true if permission is granted, false otherwise.
 */
const checkAndRequestPermission = async (): Promise<boolean> => {
    if (typeof Notification === 'undefined' || !('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

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

    if (hasPermission && typeof Notification !== 'undefined') {
        new Notification(title, options);
    }
};
