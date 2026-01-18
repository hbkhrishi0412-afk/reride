import type { Conversation } from '../types';
import { queueRequest } from '../utils/requestQueue';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Attach JWT if it exists so protected conversation routes succeed
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
 * Save conversation to MongoDB
 */
export async function saveConversationToMongoDB(conversation: Conversation): Promise<{ success: boolean; data?: Conversation; error?: string }> {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'conversationService.ts:11',message:'POST /api/conversations request',data:{conversationId:conversation.id,hasMessages:conversation.messages.length > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
    // #endregion
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(conversation),
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'conversationService.ts:19',message:'POST /api/conversations response',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'conversationService.ts:22',message:'POST /api/conversations error',data:{status:response.status,error:errorData.reason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'conversationService.ts:37',message:'PUT /api/conversations request',data:{conversationId,hasMessage:!!message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
    // #endregion
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ conversationId, message }),
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'conversationService.ts:45',message:'PUT /api/conversations response',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ reason: 'Unknown error' }));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'conversationService.ts:48',message:'PUT /api/conversations error',data:{status:response.status,error:errorData.reason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'bug-4'})}).catch(()=>{});
      // #endregion
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
    const result = await queueRequest(
      async () => {
        const params = new URLSearchParams();
        if (customerId) params.append('customerId', customerId);
        if (sellerId) params.append('sellerId', sellerId);

        // Only add query string if there are params, otherwise just use the base URL
        const queryString = params.toString();
        const url = queryString 
          ? `${API_BASE_URL}/conversations?${queryString}`
          : `${API_BASE_URL}/conversations`;

        const response = await fetch(url, { headers: getAuthHeaders() });

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
    console.error('Error getting conversations from MongoDB:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

