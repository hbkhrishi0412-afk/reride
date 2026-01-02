/**
 * Centralized authenticated fetch helper
 * Handles JWT tokens, token refresh, and session cookies
 */

interface FetchOptions extends RequestInit {
  skipAuth?: boolean; // Skip authentication for public endpoints
  retryOn401?: boolean; // Retry request after token refresh (default: true)
}

// Track token refresh state to prevent duplicate refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let refreshTokenKnownInvalid = false; // Track if refresh token is known to be invalid

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
 * Uses singleton pattern to prevent duplicate refresh attempts
 */
const refreshToken = async (): Promise<string | null> => {
  // If refresh token is known to be invalid, don't try again
  if (refreshTokenKnownInvalid) {
    return null;
  }

  // If a refresh is already in progress, wait for it instead of starting a new one
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Start new refresh attempt
  isRefreshing = true;
  refreshPromise = (async (): Promise<string | null> => {
    try {
      const refreshTokenValue = localStorage.getItem('reRideRefreshToken');
      if (!refreshTokenValue) {
        console.warn('⚠️ No refresh token available');
        refreshTokenKnownInvalid = true;
        // Clear all tokens to prevent inconsistent state with stale access tokens
        clearAuthTokens();
        return null;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for session-based auth
        body: JSON.stringify({ action: 'refresh-token', refreshToken: refreshTokenValue }),
      });

      if (response.status === 401 || response.status === 400) {
        // Refresh token expired or invalid - mark as invalid and clear all tokens
        refreshTokenKnownInvalid = true;
        console.warn('⚠️ Refresh token expired or invalid. Please log in again.');
        clearAuthTokens();
        return null;
      }

      if (!response.ok) {
        // Handle different error status codes appropriately
        if (response.status === 500 || response.status === 502 || response.status === 503) {
          // Server errors - don't mark as invalid, might be temporary
          console.warn(`⚠️ Token refresh server error (${response.status}). This may be temporary.`);
        } else if (response.status === 429) {
          // Rate limiting - don't mark as invalid, just wait
          console.warn('⚠️ Token refresh rate limited. Please try again later.');
        } else {
          // Other errors (like 403, 404, etc.)
          console.warn(`⚠️ Token refresh request failed with status ${response.status}`);
        }
        // Don't mark as invalid on non-401/400 errors - they might be temporary
        return null;
      }

      const result = await response.json();
      
      if (result.success && result.accessToken) {
        localStorage.setItem('reRideAccessToken', result.accessToken);
        if (result.refreshToken) {
          localStorage.setItem('reRideRefreshToken', result.refreshToken);
        }
        // Reset invalid flag on successful refresh
        refreshTokenKnownInvalid = false;
        console.log('✅ Token refreshed successfully');
        return result.accessToken;
      }

      console.warn('⚠️ Token refresh response missing access token');
      return null;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return null;
    } finally {
      // Reset refresh state
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Reset the refresh token invalid flag
 * Call this when new tokens are successfully stored (e.g., after login)
 */
export const resetRefreshTokenInvalidFlag = () => {
  refreshTokenKnownInvalid = false;
  isRefreshing = false;
  refreshPromise = null;
};

/**
 * Public function to refresh authentication token
 * Use this for proactive token refresh before critical operations (e.g., password updates)
 * @returns Promise<string | null> - New access token or null if refresh failed
 */
export const refreshAuthToken = async (): Promise<string | null> => {
  return refreshToken();
};

/**
 * Clear all authentication tokens
 * @param resetInvalidFlag - If true, reset the refreshTokenKnownInvalid flag (default: false)
 *                            Set to true when user logs in successfully, false when clearing due to invalid token
 */
const clearAuthTokens = (resetInvalidFlag: boolean = false) => {
  try {
    localStorage.removeItem('reRideAccessToken');
    localStorage.removeItem('reRideRefreshToken');
    localStorage.removeItem('reRideCurrentUser');
    sessionStorage.removeItem('currentUser');
    // Only reset invalid flag if explicitly requested (e.g., on successful login)
    if (resetInvalidFlag) {
      refreshTokenKnownInvalid = false;
    }
    isRefreshing = false;
    refreshPromise = null;
  } catch (error) {
    console.warn('Failed to clear tokens:', error);
  }
};

/**
 * Check if current access token is valid (not expired)
 * This is a simple check - actual validation happens on server
 * @returns true if token appears valid, false otherwise
 */
export const isTokenLikelyValid = (): boolean => {
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
      
      // Check if token expires in next 120 seconds (increased buffer time for production reliability)
      // This gives us more time to refresh before expiration, especially important in production
      // where network latency might be higher
      const now = Math.floor(Date.now() / 1000);
      const bufferSeconds = 120; // 2 minutes buffer for production safety
      return exp > (now + bufferSeconds);
    } catch {
      // If we can't parse, be conservative and assume it might be expired
      // This will trigger a proactive refresh
      return false;
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
    // Only if refresh token is not known to be invalid
    if (!skipAuth && retryOn401 && !isTokenLikelyValid() && !refreshTokenKnownInvalid) {
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
    // Skip refresh attempt if refresh token is known to be invalid
    if (response.status === 401 && retryOn401 && !skipAuth && !refreshTokenKnownInvalid) {
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
            // Clear tokens but don't mark refresh token as invalid here
            // because we successfully refreshed it - the issue might be with the specific endpoint
            clearAuthTokens();
            // Don't redirect immediately - let the caller handle the error first
            // The redirect will happen when the error is shown to the user
          }
        } else {
          // Token refresh failed (refresh token likely invalid or missing)
          // clearAuthTokens already called in refreshToken function when:
          // - Refresh token is missing from localStorage (line 60)
          // - Refresh token is invalid per API response (401/400 at line 75)
          // Don't log again to avoid duplicate messages
        }
      } catch (refreshError) {
        // Error during token refresh - return original 401 response
        console.warn('⚠️ Error during token refresh:', refreshError);
        return response; // Return original 401 response
      }
    } else if (response.status === 401 && refreshTokenKnownInvalid) {
      // Refresh token is known to be invalid, don't try to refresh
      // This prevents duplicate refresh attempts and console spam
      // The error will be handled by the caller
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

