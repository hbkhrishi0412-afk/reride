import type { BuyerActivity } from '../types';
import { queueRequest } from '../utils/requestQueue';

const API_BASE_URL = '/api';

// Attach JWT so buyer activity APIs that require auth work in production
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
 * Save buyer activity to Supabase
 */
export async function saveBuyerActivityToSupabase(activity: BuyerActivity): Promise<{ success: boolean; data?: BuyerActivity; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/buyer-activity`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(activity),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to save buyer activity' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error saving buyer activity to Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get buyer activity from Supabase
 */
export async function getBuyerActivityFromSupabase(userId: string): Promise<{ success: boolean; data?: BuyerActivity; error?: string }> {
  try {
    const result = await queueRequest(
      async () => {
        const response = await fetch(`${API_BASE_URL}/buyer-activity?userId=${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
          throw new Error(errorData.reason || 'Failed to get buyer activity');
        }

        const result = await response.json();
        return result.data;
      },
      { id: `buyer-activity-${userId}` }
    );

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting buyer activity from Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update buyer activity in Supabase
 */
export async function updateBuyerActivityInSupabase(userId: string, updates: Partial<BuyerActivity>): Promise<{ success: boolean; data?: BuyerActivity; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/buyer-activity`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, ...updates }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to update buyer activity' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error updating buyer activity in Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}


