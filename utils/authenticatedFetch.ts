/**
 * Centralized authenticated fetch helper
 * Handles JWT tokens, token refresh, and session cookies
 */

interface FetchOptions extends RequestInit {
  skipAuth?: boolean; // Skip authentication for public endpoints
  retryOn401?: boolean; // Retry request after token refresh (default: true)
}

/**
 * Get authentication headers with JWT token
 */
export const getAuthHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  try {
    const token = localStorage.getItem('reRideAccessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }

  return headers;
};

/**
 * Refresh access token using refresh token
 */
const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshTokenValue = localStorage.getItem('reRideRefreshToken');
    if (!refreshTokenValue) {
      return null;
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for session-based auth
      body: JSON.stringify({ action: 'refresh-token', refreshToken: refreshTokenValue }),
    });

    if (response.status === 401 || response.status === 400) {
      // Refresh token expired or invalid - clear all tokens
      clearAuthTokens();
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    
    if (result.success && result.accessToken) {
      localStorage.setItem('reRideAccessToken', result.accessToken);
      return result.accessToken;
    }

    return null;
  } catch (error) {
    console.warn('Token refresh failed:', error);
    return null;
  }
};

/**
 * Clear all authentication tokens
 */
const clearAuthTokens = () => {
  try {
    localStorage.removeItem('reRideAccessToken');
    localStorage.removeItem('reRideRefreshToken');
    localStorage.removeItem('reRideCurrentUser');
    sessionStorage.removeItem('currentUser');
  } catch (error) {
    console.warn('Failed to clear tokens:', error);
  }
};

/**
 * Authenticated fetch with automatic token refresh on 401
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options (extends RequestInit)
 * @returns Promise<Response>
 */
export const authenticatedFetch = async (
  url: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const { skipAuth = false, retryOn401 = true, ...fetchOptions } = options;

  // Prepare headers
  const headers = skipAuth
    ? { 'Content-Type': 'application/json' }
    : getAuthHeaders();

  // Merge with any existing headers
  const mergedHeaders = {
    ...headers,
    ...(fetchOptions.headers || {}),
  };

  // First attempt
  let response = await fetch(url, {
    ...fetchOptions,
    headers: mergedHeaders,
    credentials: 'include', // Always include cookies for session-based auth
  });

  // Handle 401 Unauthorized - try to refresh token and retry
  if (response.status === 401 && retryOn401 && !skipAuth) {
    console.log('🔄 401 received, attempting token refresh...');
    
    const newToken = await refreshToken();
    
    if (newToken) {
      console.log('✅ Token refreshed, retrying request...');
      // Retry with new token
      response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...mergedHeaders,
          'Authorization': `Bearer ${newToken}`,
        },
        credentials: 'include',
      });
    } else {
      console.warn('⚠️ Token refresh failed, clearing auth and redirecting to login');
      clearAuthTokens();
      
      // Redirect to login if we're not already there
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }

  return response;
};

/**
 * Helper to handle API response with proper error handling
 */
export const handleApiResponse = async <T = any>(
  response: Response
): Promise<{ success: boolean; data?: T; error?: string; reason?: string }> => {
  if (!response.ok) {
    // Handle 401 - already handled by authenticatedFetch, but log it
    if (response.status === 401) {
      return {
        success: false,
        error: 'Unauthorized',
        reason: 'Your session has expired. Please log in again.',
      };
    }

    // Try to parse error response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          reason: errorData.reason || errorData.message || errorData.error || response.statusText,
        };
      } catch {
        // If JSON parsing fails, return status text
        return {
          success: false,
          error: `HTTP ${response.status}`,
          reason: response.statusText,
        };
      }
    }

    // Non-JSON error response
    const errorText = await response.text().catch(() => response.statusText);
    return {
      success: false,
      error: `HTTP ${response.status}`,
      reason: errorText || response.statusText,
    };
  }

  // Success response
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const data = await response.json();
      return { success: true, data };
    } catch {
      return {
        success: false,
        error: 'Invalid JSON response',
        reason: 'Server returned invalid JSON',
      };
    }
  }

  // Non-JSON success response
  return { success: true };
};

