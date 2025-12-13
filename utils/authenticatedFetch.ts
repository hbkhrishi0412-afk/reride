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
      console.warn('⚠️ No refresh token available');
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
      console.warn('⚠️ Refresh token expired or invalid');
      clearAuthTokens();
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn('⚠️ Token refresh request failed:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    
    if (result.success && result.accessToken) {
      localStorage.setItem('reRideAccessToken', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('reRideRefreshToken', result.refreshToken);
      }
      console.log('✅ Token refreshed successfully');
      return result.accessToken;
    }

    console.warn('⚠️ Token refresh response missing access token');
    return null;
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
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
 * Check if current access token is valid (not expired)
 * This is a simple check - actual validation happens on server
 */
const isTokenLikelyValid = (): boolean => {
  try {
    const token = localStorage.getItem('reRideAccessToken');
    if (!token) return false;
    
    // Try to decode token to check expiration (without verification)
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp;
      if (!exp) return true; // No expiration claim, assume valid
      
      // Check if token expires in next 30 seconds (buffer time)
      const now = Math.floor(Date.now() / 1000);
      return exp > (now + 30);
    } catch {
      return true; // If we can't parse, let server decide
    }
  } catch {
    return false;
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
  try {
    const { skipAuth = false, retryOn401 = true, ...fetchOptions } = options;

    // Proactively refresh token if it's likely expired (for critical operations like password updates)
    if (!skipAuth && retryOn401 && !isTokenLikelyValid()) {
      try {
        console.log('🔄 Token appears expired, proactively refreshing...');
        const newToken = await refreshToken();
        if (newToken) {
          console.log('✅ Token refreshed proactively');
        }
      } catch (refreshError) {
        // Silently handle token refresh errors - don't block the main request
        console.warn('⚠️ Proactive token refresh failed:', refreshError);
      }
    }

    // Prepare headers
    const headers = skipAuth
      ? { 'Content-Type': 'application/json' }
      : getAuthHeaders();

    // Merge with any existing headers
    const mergedHeaders = {
      ...headers,
      ...(fetchOptions.headers || {}),
    };

    // First attempt - wrap in try-catch to handle network errors
    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers: mergedHeaders,
        credentials: 'include', // Always include cookies for session-based auth
      });
    } catch (fetchError) {
      // Network error, CORS error, or other fetch failures
      // Return a Response-like object that indicates failure
      // This prevents the error from propagating to ErrorBoundary
      console.warn('⚠️ Fetch error in authenticatedFetch:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Network error', 
          reason: 'Unable to connect to server. Please check your internet connection.' 
        }),
        { 
          status: 0, // Status 0 indicates network error
          statusText: 'Network Error',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle 401 Unauthorized - try to refresh token and retry
    if (response.status === 401 && retryOn401 && !skipAuth) {
      try {
        console.log('🔄 401 received, attempting token refresh...');
        
        const newToken = await refreshToken();
        
        if (newToken) {
          console.log('✅ Token refreshed, retrying request...');
          // Retry with new token - wrap in try-catch
          try {
            response = await fetch(url, {
              ...fetchOptions,
              headers: {
                ...mergedHeaders,
                'Authorization': `Bearer ${newToken}`,
              },
              credentials: 'include',
            });
          } catch (retryError) {
            // Network error on retry - return original 401 response
            console.warn('⚠️ Network error on retry after token refresh:', retryError);
            return response; // Return original 401 response
          }
          
          // If retry still returns 401, token refresh didn't help (maybe different issue)
          if (response.status === 401) {
            console.warn('⚠️ Request still returns 401 after token refresh - authentication issue persists');
            clearAuthTokens();
            // Don't redirect immediately - let the caller handle the error first
            // The redirect will happen when the error is shown to the user
          }
        } else {
          console.warn('⚠️ Token refresh failed, clearing auth tokens');
          clearAuthTokens();
          // Don't redirect immediately - let the caller handle the error and show message first
          // The error handler in AppProvider will show the error, then user can manually navigate to login
        }
      } catch (refreshError) {
        // Error during token refresh - return original 401 response
        console.warn('⚠️ Error during token refresh:', refreshError);
        return response; // Return original 401 response
      }
    }

    return response;
  } catch (error) {
    // Catch any unexpected errors and return a safe Response object
    // This prevents errors from propagating to ErrorBoundary
    console.error('❌ Unexpected error in authenticatedFetch:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Request failed', 
        reason: 'An unexpected error occurred. Please try again.' 
      }),
      { 
        status: 500,
        statusText: 'Internal Error',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
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

