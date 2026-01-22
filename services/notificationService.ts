import type { Notification } from '../types';
import { queueRequest } from '../utils/requestQueue';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Attach JWT so notification APIs that require auth work in production
const getAuthHeaders = (): Record<string, string> => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { 'Content-Type': 'application/json' };
    }
    const token = localStorage.getItem('reRideAccessToken');
    if (!token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

/**
 * Save notification to Supabase
 */
export async function saveNotificationToSupabase(notification: Notification): Promise<{ success: boolean; data?: Notification; error?: string }> {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:11',message:'POST /api/notifications request',data:{notificationId:notification.id,recipientEmail:notification.recipientEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
    // #endregion
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(notification),
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:19',message:'POST /api/notifications response',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:22',message:'POST /api/notifications error',data:{status:response.status,error:errorData.reason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
      // #endregion
      return { success: false, error: errorData.reason || 'Failed to save notification' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
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
          ? `${API_BASE_URL}/notifications?${queryString}`
          : `${API_BASE_URL}/notifications`;

        const response = await fetch(url, { headers: getAuthHeaders() });

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
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notificationId, updates }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to update notification' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
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
