import type { Conversation } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Save conversation to MongoDB
 */
export async function saveConversationToMongoDB(conversation: Conversation): Promise<{ success: boolean; data?: Conversation; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(conversation),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to save conversation' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error saving conversation to MongoDB:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Add message to conversation in MongoDB
 */
export async function addMessageToConversation(conversationId: string, message: any): Promise<{ success: boolean; data?: Conversation; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, message }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to add message' };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error adding message to conversation:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get conversations from MongoDB
 */
export async function getConversationsFromMongoDB(customerId?: string, sellerId?: string): Promise<{ success: boolean; data?: Conversation[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (customerId) params.append('customerId', customerId);
    if (sellerId) params.append('sellerId', sellerId);

    // Only add query string if there are params, otherwise just use the base URL
    const queryString = params.toString();
    const url = queryString 
      ? `${API_BASE_URL}/conversations?${queryString}`
      : `${API_BASE_URL}/conversations`;

    const response = await fetch(url);

    // Handle 404 gracefully - API route might not be available in development
    // Silently fall back to localStorage (no console error - this is expected in dev)
    if (response.status === 404) {
      return { success: false, error: 'API route not available' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      return { success: false, error: errorData.reason || 'Failed to get conversations' };
    }

    const result = await response.json();
    return { success: true, data: result.data || [] };
  } catch (error) {
    // Network errors or other fetch failures - gracefully fall back
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('Failed to fetch conversations from API. Using localStorage fallback.');
      return { success: false, error: 'Network error - API unavailable' };
    }
    console.error('Error getting conversations from MongoDB:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

