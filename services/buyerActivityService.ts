import type { BuyerActivity } from '../types';
import { queueRequest } from '../utils/requestQueue';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

/**
 * Save buyer activity to Supabase
 */
export async function saveBuyerActivityToSupabase(activity: BuyerActivity): Promise<{ success: boolean; data?: BuyerActivity; error?: string }> {
  try {
    const normalized: BuyerActivity = {
      ...activity,
      userId: String(activity.userId || '').toLowerCase().trim(),
    };
    const response = await authenticatedFetch('/api/buyer-activity', {
      method: 'POST',
      body: JSON.stringify(normalized),
    });

    const result = await handleApiResponse<{ data?: BuyerActivity; reason?: string; error?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || 'Failed to save buyer activity' };
    }
    return { success: true, data: result.data?.data };
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
        const q = encodeURIComponent(String(userId).toLowerCase().trim());
        const response = await authenticatedFetch(`/api/buyer-activity?userId=${q}`, { method: 'GET' });
        const parsed = await handleApiResponse<{ data?: BuyerActivity; reason?: string; error?: string }>(response);
        if (!parsed.success) {
          throw new Error(parsed.reason || parsed.error || 'Failed to get buyer activity');
        }
        return parsed.data?.data;
      },
      { id: `buyer-activity-${userId}` }
    );

    return { success: true, data: result || undefined };
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
    const uid = String(userId).toLowerCase().trim();
    const response = await authenticatedFetch('/api/buyer-activity', {
      method: 'PUT',
      body: JSON.stringify({ ...updates, userId: uid }),
    });

    const result = await handleApiResponse<{ data?: BuyerActivity; reason?: string; error?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || 'Failed to update buyer activity' };
    }
    return { success: true, data: result.data?.data };
  } catch (error) {
    console.error('Error updating buyer activity in Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}


