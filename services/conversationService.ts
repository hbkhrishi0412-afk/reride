import type { Conversation } from '../types';
import { queueRequest } from '../utils/requestQueue';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

/**
 * Save conversation to Supabase
 */
export async function saveConversationToSupabase(conversation: Conversation): Promise<{ success: boolean; data?: Conversation; error?: string }> {
  try {
    const response = await authenticatedFetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(conversation),
    });

    const result = await handleApiResponse<{ data?: Conversation; reason?: string; error?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || 'Failed to save conversation' };
    }
    return { success: true, data: result.data?.data };
  } catch (error) {
    console.error('Error saving conversation to Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Add message to conversation in Supabase
 */
export async function addMessageToConversation(conversationId: string, message: any): Promise<{ success: boolean; data?: Conversation; error?: string }> {
  try {
    console.log('📡 Calling API to save message:', { 
      url: `/api/conversations`, 
      conversationId, 
      messageId: message?.id,
      method: 'PUT'
    });
    
    const response = await authenticatedFetch('/api/conversations', {
      method: 'PUT',
      body: JSON.stringify({ conversationId, message }),
    });

    console.log('📡 API response status:', response.status, response.statusText);

    const result = await handleApiResponse<{ data?: Conversation; reason?: string; error?: string }>(response);
    if (!result.success) {
      const errorMessage = result.reason || result.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('❌ API error response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        conversationId,
        messageId: message?.id
      });
      return { success: false, error: errorMessage };
    }

    console.log('✅ API success response:', { conversationId, hasData: !!result.data?.data });
    return { success: true, data: result.data?.data };
  } catch (error) {
    console.error('❌ Network error adding message to conversation:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof TypeError ? 'NetworkError' : 'Unknown',
      conversationId,
      messageId: message?.id
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get conversations from Supabase
 */
export async function getConversationsFromSupabase(customerId?: string, sellerId?: string): Promise<{ success: boolean; data?: Conversation[]; error?: string }> {
  try {
    const result = await queueRequest(
      async () => {
        const params = new URLSearchParams();
        if (customerId) params.append('customerId', customerId);
        if (sellerId) params.append('sellerId', sellerId);

        // Only add query string if there are params, otherwise just use the base URL
        const queryString = params.toString();
        const url = queryString 
          ? `/api/conversations?${queryString}`
          : `/api/conversations`;

        const response = await authenticatedFetch(url);

        // Handle 404 gracefully - API route might not be available in development
        // Silently fall back to localStorage (no console error - this is expected in dev)
        if (response.status === 404) {
          return { success: false, error: 'API route not available' };
        }

        const parsed = await handleApiResponse<{ data?: Conversation[]; reason?: string; error?: string }>(response);
        if (!parsed.success) {
          return { success: false, error: parsed.reason || parsed.error || 'Failed to get conversations' };
        }
        return { success: true, data: parsed.data?.data || [] };
      },
      { priority: 5, id: 'conversations', maxRetries: 2 }
    );
    
    return result;
  } catch (error) {
    // Network errors or other fetch failures - gracefully fall back
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('Failed to fetch conversations from API. Using localStorage fallback.');
      return { success: false, error: 'Network error - API unavailable' };
    }
    console.error('Error getting conversations from Supabase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Backward compatibility aliases
export const saveConversationToMongoDB = saveConversationToSupabase;
export const getConversationsFromMongoDB = getConversationsFromSupabase;

