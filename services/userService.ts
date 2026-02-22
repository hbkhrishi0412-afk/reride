
import type { User } from '../types';
import { isDevelopmentEnvironment } from '../utils/environment';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

// Fallback mock users for development only (no credentials stored in source)
// In production, all users come from Supabase — these are never used.
const FALLBACK_USERS: User[] = [
  {
    name: 'Demo Seller',
    email: 'seller@test.com',
    mobile: '+91-00000-00000',
    role: 'seller',
    location: 'Mumbai',
    status: 'active',
    createdAt: new Date().toISOString(),
    dealershipName: 'Demo Motors',
    isVerified: false,
    subscriptionPlan: 'free',
    featuredCredits: 0,
    usedCertifications: 0
  },
  {
    name: 'Demo Customer',
    email: 'customer@test.com',
    mobile: '+91-00000-00001',
    role: 'customer',
    location: 'Delhi',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    name: 'Demo Admin',
    email: 'admin@test.com',
    mobile: '+91-00000-00002',
    role: 'admin',
    location: 'Bangalore',
    status: 'active',
    createdAt: new Date().toISOString(),
  }
];

// --- Request Deduplication ---
// Track ongoing requests to prevent duplicate simultaneous requests
const pendingRequests = new Map<string, Promise<any>>();

// --- API Helpers ---
const getAuthHeader = (): Record<string, string> => {
  try {
    // Get JWT token from localStorage (client-side only)
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { 'Content-Type': 'application/json' };
    }
    const token = localStorage.getItem('reRideAccessToken');
    if (!token) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

const storeTokens = (accessToken: string, refreshToken: string) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem('reRideAccessToken', accessToken);
    localStorage.setItem('reRideRefreshToken', refreshToken);
    
    // Reset refresh token invalid flag when new tokens are stored (fire-and-forget)
    // This ensures that after successful login/register, we can refresh tokens again
    // Use dynamic import to avoid circular dependencies
    import('../utils/authenticatedFetch').then(({ resetRefreshTokenInvalidFlag }) => {
      resetRefreshTokenInvalidFlag();
    }).catch(() => {
      // Silently fail if module can't be imported (shouldn't happen in normal flow)
      // This is a non-critical operation - tokens are already stored
    });
  } catch (error) {
    console.warn('Failed to store tokens:', error);
  }
};

const clearTokens = () => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem('reRideAccessToken');
    localStorage.removeItem('reRideRefreshToken');
    localStorage.removeItem('reRideCurrentUser');
  } catch (error) {
    console.warn('Failed to clear tokens:', error);
  }
};

const handleResponse = async (response: Response): Promise<any> => {
    if (!response.ok) {
        // Handle rate limiting (429) - don't retry, use fallback immediately
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            console.warn(`⚠️ Rate limited (429). Server requested wait time: ${waitTime}ms. Using fallback.`);
            throw new Error('Too many requests. Please wait a moment and try again.');
        }
        
        // Handle service unavailable (503) - don't retry, use fallback immediately
        if (response.status === 503) {
            console.warn('⚠️ Service unavailable (503). Using fallback mechanism.');
            throw new Error('Service temporarily unavailable. Please try again later.');
        }
        
        // Handle 401 Unauthorized - try to refresh token first
        if (response.status === 401) {
            console.warn('401 Unauthorized detected, attempting token refresh...');
            
            // Try to refresh token before giving up
            try {
                const refreshToken = localStorage.getItem('reRideRefreshToken');
                if (refreshToken) {
                    const refreshResponse = await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'refresh-token', refreshToken })
                    });
                    
                    // Don't retry if we get rate limited or service unavailable
                    if (refreshResponse.status === 429 || refreshResponse.status === 503) {
                        console.warn('⚠️ Token refresh rate limited or service unavailable. Clearing tokens.');
                        clearTokens();
                        throw new Error('Service temporarily unavailable. Please log in again.');
                    }
                    
                    if (refreshResponse.ok) {
                        const refreshData = await refreshResponse.json();
                        if (refreshData.success && refreshData.accessToken) {
                            storeTokens(refreshData.accessToken, refreshData.refreshToken || refreshToken);
                            console.log('✅ Token refreshed successfully, retrying original request');
                            // Return a special indicator that token was refreshed
                            // The caller should retry the original request
                            throw new Error('TOKEN_REFRESHED');
                        }
                    }
                }
            } catch (refreshError) {
                if (refreshError instanceof Error && refreshError.message === 'TOKEN_REFRESHED') {
                    // Re-throw to indicate caller should retry
                    throw refreshError;
                }
                // Refresh failed, continue with clearing tokens
            }
            
            // Token refresh failed or no refresh token - clear tokens and redirect
            console.warn('Token refresh failed or no refresh token, clearing tokens');
            clearTokens();
            
            const error = await response.json().catch(() => ({ error: 'Authentication expired. Please log in again and try again.' }));
            const errorMessage = error.error || error.reason || 'Authentication expired. Please log in again and try again.';
            
            // Show user-friendly error message
            if (typeof window !== 'undefined') {
                // Don't redirect immediately - let the component handle the error
                // Only redirect if we're not already on a page that can handle the error
                const currentPath = window.location.pathname;
                if (!currentPath.includes('/profile') && !currentPath.includes('/dashboard')) {
                    // Small delay to allow error message to be shown
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                }
            }
            
            throw new Error(errorMessage);
        }
        // For 500 errors, don't throw - let the fallback mechanism handle it
        if (response.status >= 500) {
            console.warn(`API returned ${response.status}: ${response.statusText}, will use fallback data`);
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
        const error = await response.json().catch(() => ({ error: `API Error: ${response.statusText}` }));
        throw new Error(error.error || `Failed to fetch: ${response.statusText}`);
    }
    return response.json();
}

// --- Local Development (localStorage) Functions ---

export const getUsersLocal = async (): Promise<User[]> => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return FALLBACK_USERS;
    }
    try {
        let usersJson = localStorage.getItem('reRideUsers');
        if (!usersJson || usersJson === '[]' || usersJson === 'null') {
            const usersToStore = FALLBACK_USERS;
            localStorage.setItem('reRideUsers', JSON.stringify(usersToStore));
            usersJson = JSON.stringify(usersToStore);
        } else {
            const parsedUsers = JSON.parse(usersJson);
            if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) {
                const usersToStore = FALLBACK_USERS;
                localStorage.setItem('reRideUsers', JSON.stringify(usersToStore));
                usersJson = JSON.stringify(usersToStore);
            }
        }
        return JSON.parse(usersJson);
    } catch {
        return FALLBACK_USERS;
    }
};

const updateUserLocal = async (userData: Partial<User> & { email: string }): Promise<User> => {
    let users = await getUsersLocal();
    let updatedUser: User | undefined;
    const passwordWasUpdated = userData.password !== undefined;
    
    users = users.map(u => {
        if (u.email === userData.email) {
            // Create updated user object, handling null values explicitly
            updatedUser = { ...u };
            
            // Update all provided fields
            Object.keys(userData).forEach(key => {
                if (key !== 'email') {
                    const value = (userData as any)[key];
                    // Handle null values - explicitly set to undefined for removal
                    if (value === null) {
                        delete (updatedUser as any)[key];
                    } else if (value !== undefined) {
                        (updatedUser as any)[key] = value;
                    }
                }
            });
            
            return updatedUser;
        }
        return u;
    });
    
    // Check if user was found before proceeding
    if (!updatedUser) throw new Error("User not found to update.");
    
    // Only save to localStorage and clear cache if update succeeded
    localStorage.setItem('reRideUsers', JSON.stringify(users));
    
    // CRITICAL FIX: When password is updated, clear session data to force fresh login
    // BUT: Keep the localStorage update (reRideUsers) since we just saved the new password there
    // Only execute this after confirming the update succeeded
    if (passwordWasUpdated) {
        // Clear production cache if it exists (might have stale data)
        localStorage.removeItem('reRideUsers_prod');
        // Clear current user session to force re-authentication with new password
        localStorage.removeItem('reRideCurrentUser');
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('accessToken');
        }
        // NOTE: We keep 'reRideUsers' because we just updated it with the new password
        // The next login will use the updated password from localStorage
    }
    
    return updatedUser;
};

const deleteUserLocal = async (email: string): Promise<{ success: boolean, email: string }> => {
    let users = await getUsersLocal();
    users = users.filter(u => u.email !== email);
    localStorage.setItem('reRideUsers', JSON.stringify(users));
    return { success: true, email };
};

const loginLocal = async (
    credentials: { email?: string; password?: string; role?: string; skipRoleCheck?: boolean }
): Promise<{ success: boolean, user?: User, reason?: string, detectedRole?: string }> => {
    const { email, password, role, skipRoleCheck } = credentials;
    
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPassword = (password || '').trim();
    
    const users = await getUsersLocal();
    
    // Find user by email (case-insensitive)
    const user = users.find(u => (u.email || '').trim().toLowerCase() === normalizedEmail);
    
    if (!user) {
        return { success: false, reason: 'Invalid credentials.' };
    }
    
    // Development localStorage uses plain-text password comparison only.
    // Production always goes through the API with proper bcrypt hashing.
    const storedPassword = (user.password || '').trim();
    const isPasswordValid = storedPassword === normalizedPassword;
    
    if (!isPasswordValid) {
        return { success: false, reason: 'Invalid credentials.' };
    }
    
    if (!skipRoleCheck && role && user.role !== role) {
        return { 
            success: false, 
            reason: `User is not a registered ${role}.`,
            detectedRole: user.role 
        };
    }
    
    if (user.status === 'inactive') {
        return { success: false, reason: 'Your account has been deactivated.' };
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
};

const registerLocal = async (credentials: any): Promise<{ success: boolean, user?: User, reason?: string }> => {
    const { email } = credentials;
    const users = await getUsersLocal();
    if (users.some(u => u.email === email)) {
        return { success: false, reason: 'An account with this email already exists.' };
    }
    const newUser: User = {
        ...credentials,
        status: 'active',
        createdAt: new Date().toISOString(),
        subscriptionPlan: 'free', featuredCredits: 0, usedCertifications: 0,
    };
    users.push(newUser);
    localStorage.setItem('reRideUsers', JSON.stringify(users));
    const { password: _, ...userWithoutPassword } = newUser;
    return { success: true, user: userWithoutPassword };
};

// --- Production (API) Functions ---

const getUsersApi = async (role?: 'seller' | 'customer' | 'admin'): Promise<User[]> => {
  // Use authenticatedFetch for production API calls
  try {
    const { authenticatedFetch } = await import('../utils/authenticatedFetch');
    // If role is specified, fetch users by role (public access for sellers)
    const url = role ? `/api/users?role=${role}` : '/api/users';
    const response = await authenticatedFetch(url);
    return handleResponse(response);
  } catch (error) {
    // If authenticatedFetch fails, try regular fetch (for development)
    // For sellers, use regular fetch since it's public access
    const url = role ? `/api/users?role=${role}` : '/api/users';
    const response = await fetch(url, {
      headers: getAuthHeader()
    });
    return handleResponse(response);
  }
};

const updateUserApi = async (userData: Partial<User> & { email: string }): Promise<User> => {
    // Use authenticatedFetch - it handles token refresh automatically
    const response = await authenticatedFetch('/api/users', {
        method: 'PUT',
        body: JSON.stringify(userData),
    });
    
    // CRITICAL FIX: Check if password was updated from response header
    const passwordWasUpdated = userData.password !== undefined || 
                               (response.headers && response.headers.get('X-Password-Updated') === 'true');
    
    // Use handleApiResponse to parse the response properly
    const result = await handleApiResponse<User>(response);
    
    if (!result.success) {
        throw new Error(result.reason || result.error || 'Failed to update user');
    }
    
    // Clear cache when password is updated to force fresh login
    if (passwordWasUpdated) {
        // Clear both development and production caches
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('reRideUsers');
            localStorage.removeItem('reRideUsers_prod');
            // Also clear any cached user data
            localStorage.removeItem('reRideCurrentUser');
        }
    }
    
    return result.data!;
};

const deleteUserApi = async (email: string): Promise<{ success: boolean, email: string }> => {
    const response = await authenticatedFetch('/api/users', {
        method: 'DELETE',
        body: JSON.stringify({ email }),
    });
    const result = await handleApiResponse<{ success: boolean, email: string }>(response);
    if (!result.success) {
        throw new Error(result.reason || result.error || 'Failed to delete user');
    }
    return result.data!;
};

const authApi = async (body: any): Promise<any> => {
    // Create a unique key for request deduplication based on action and credentials
    const requestKey = body.action === 'login' 
        ? `auth-${body.action}-${body.email}-${body.role || ''}`
        : body.action === 'register'
        ? `auth-${body.action}-${body.email}`
        : `auth-${body.action}-${JSON.stringify(body)}`;
    
    // Check if there's already a pending request with the same key
    if (pendingRequests.has(requestKey)) {
        console.log('⏳ Duplicate request detected, reusing pending request:', requestKey);
        return pendingRequests.get(requestKey)!;
    }
    
    // Create the request promise
    const requestPromise = (async () => {
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            
            // Handle rate limiting (429) - don't retry immediately, wait and use fallback
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
                console.warn(`⚠️ Rate limited (429). Server requested wait time: ${waitTime}ms`);
                
                // For rate limiting, don't retry - use fallback immediately
                throw new Error('Too many requests. Please wait a moment and try again.');
            }
            
            // For 5xx, parse body and surface server reason/error so user sees the real message
            if (response.status >= 500 && response.status < 600) {
                let errorMessage = `Server error (${response.status}). Please try again later.`;
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage = errorData.reason || errorData.error || errorMessage;
                    }
                } catch (_) { /* use fallback message */ }
                console.warn(`⚠️ Server ${response.status}:`, errorMessage);
                throw new Error(errorMessage);
            }
            
            // Check if response is ok first
            if (!response.ok) {
                // Try to parse error response, but handle cases where response might be empty
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                let errorDetails: any = null;
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage = errorData.reason || errorData.error || errorMessage;
                        errorDetails = errorData;
                        
                        // Include hint if available (for development/debugging)
                        if (errorData.hint && process.env.NODE_ENV !== 'production') {
                            console.info('💡 Server hint:', errorData.hint);
                        }
                    }
                } catch (parseError) {
                    // If we can't parse the error response, use the default error message
                    console.warn('Could not parse error response:', parseError);
                }
                
                // For 503 errors (Service Unavailable), provide more context
                if (response.status === 503 && errorDetails?.fallback) {
                    // This is a database connection issue
                    console.error('❌ Database connection failed:', errorMessage);
                    throw new Error(errorMessage);
                }
                
                throw new Error(errorMessage);
            }
            
            // Parse successful response
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }
            
            try {
                const result = await response.json();
                return result;
            } catch (parseError) {
                throw new Error('Failed to parse server response as JSON');
            }
        } finally {
            // Remove from pending requests after completion
            pendingRequests.delete(requestKey);
        }
    })();
    
    // Store the pending request
    pendingRequests.set(requestKey, requestPromise);
    
    return requestPromise;
};


// --- Environment Detection ---
// Use local storage in development, API in production
// Force development mode on localhost even if running on different ports
const isDevelopment = (() => {
  // Check if we're explicitly in development mode
  if (isDevelopmentEnvironment()) return true;
  
  // Check hostname for local development
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  
  // Check if we're on a local development port (common ports)
  const port = window.location.port;
  if (port && ['5173', '3000', '3001', '8080', '5174', '4173'].includes(port)) return true;
  
  // Check for Vercel preview URLs - these should use API (production mode)
  if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) return false;
  
  // Check for other production domains (not localhost)
  if (hostname && !hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !port) {
    return false; // Production domain without port = production
  }
  
  // Default to development if we can't determine (safer for local dev)
  return true;
})();

// --- Exported Environment-Aware Service Functions ---

export const getUsers = async (role?: 'seller' | 'customer' | 'admin'): Promise<User[]> => {
  try {
    // Always try API first for production, with fallback to local
    if (!isDevelopment) {
      try {
        const result = await getUsersApi(role);
        // Cache production data — only cache when fetching all users
        if (!role && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('reRideUsers_prod', JSON.stringify(result));
        }
        return result;
      } catch (error) {
        // In production, try to use cached API data (not mock data)
        if (!role && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          try {
            const cachedUsersJson = localStorage.getItem('reRideUsers_prod');
            if (cachedUsersJson) {
              const cachedUsers = JSON.parse(cachedUsersJson);
              if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
                if (role) {
                  return cachedUsers.filter((u: User) => u.role === role);
                }
                return cachedUsers;
              }
            }
          } catch {
            // Failed to load cached production data
          }
        }
        // If no cached data, return empty array (don't use mock data in production)
        return [];
      }
    } else {
      // Development mode — use local storage
      const users = await getUsersLocal();
      if (role) {
        return users.filter(u => u.role === role);
      }
      return users;
    }
  } catch (error) {
    // In production, return empty array instead of fallback users
    if (!isDevelopment) {
      return [];
    }
    // Last resort fallback only in development
    const fallback = FALLBACK_USERS;
    if (role) {
      return fallback.filter(u => u.role === role);
    }
    return fallback;
  }
};

// Convenience function to fetch sellers only (public access)
export const getSellers = async (): Promise<User[]> => {
  return getUsers('seller');
};
export const updateUser = async (userData: Partial<User> & { email: string }): Promise<User> => {
  // Always try API first for production, with fallback to local
  if (!isDevelopment) {
    try {
      return await updateUserApi(userData);
    } catch (error) {
      console.warn('API updateUser failed, falling back to local storage:', error);
      // Fallback to local storage if API fails
      return await updateUserLocal(userData);
    }
  } else {
    // Development mode - use local storage
    return await updateUserLocal(userData);
  }
};
export const deleteUser = isDevelopment ? deleteUserLocal : deleteUserApi;
export const login = async (credentials: { email?: string; password?: string; role?: string; [key: string]: unknown }): Promise<{ success: boolean, user?: User, reason?: string, detectedRole?: string }> => {
  // Validate required fields
  if (!credentials.email || String(credentials.email).trim() === '') {
    return { success: false, reason: 'Email is required.' };
  }
  if (!credentials.password || String(credentials.password).trim() === '') {
    return { success: false, reason: 'Password is required.' };
  }
  
  if (!isDevelopment) {
    // Production — use API
    try {
      const result = await authApi({ action: 'login', ...credentials });
      
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from server');
      }
      
      if (!result.success) {
        return {
          success: result.success,
          reason: result.reason,
          detectedRole: result.detectedRole,
        };
      }
      
      if (!result.user?.email || !result.user?.role) {
        throw new Error('Invalid user data received from server');
      }
      
      // Verify role matches requested role
      if (credentials.role && result.user.role !== credentials.role) {
        return { 
          success: false, 
          reason: `User is not a registered ${credentials.role}.`,
          detectedRole: result.user.role 
        };
      }
      
      // Store JWT tokens if provided
      if (result.accessToken && result.refreshToken) {
        storeTokens(result.accessToken, result.refreshToken);
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
      }
      
      return {
        success: result.success,
        user: result.user,
        reason: result.reason,
        detectedRole: result.detectedRole
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Clear stale caches on failure
      try {
        localStorage.removeItem('reRideUsers');
        localStorage.removeItem('reRideUsers_prod');
        localStorage.removeItem('reRideCurrentUser');
      } catch {
        // ignore storage errors
      }
      return { success: false, reason: errorMessage || 'Login failed. Please try again.' };
    }
  } else {
    // Development — use local storage
    const skipRoleCheck = !credentials.role;
    return await loginLocal({ ...credentials, skipRoleCheck });
  }
};
export const register = async (credentials: { email?: string; password?: string; name?: string; mobile?: string; role?: string; [key: string]: unknown }): Promise<{ success: boolean, user?: User, reason?: string }> => {
  // Validate required fields
  if (!credentials.email || String(credentials.email).trim() === '') {
    return { success: false, reason: 'Email is required.' };
  }
  if (!credentials.password || String(credentials.password).trim() === '') {
    return { success: false, reason: 'Password is required.' };
  }
  if (!credentials.name || String(credentials.name).trim() === '') {
    return { success: false, reason: 'Name is required.' };
  }
  if (!credentials.mobile || String(credentials.mobile).trim() === '') {
    return { success: false, reason: 'Mobile number is required.' };
  }
  if (!credentials.role || String(credentials.role).trim() === '') {
    return { success: false, reason: 'Role is required.' };
  }
  
  if (!isDevelopment) {
    try {
      const result = await authApi({ action: 'register', ...credentials });
      
      if (result.success && result.accessToken && result.refreshToken) {
        storeTokens(result.accessToken, result.refreshToken);
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
      }
      return result;
    } catch {
      return await registerLocal(credentials);
    }
  } else {
    return await registerLocal(credentials);
  }
};

export const logout = (): void => {
  clearTokens();
};

// Token refresh function with rate limiting protection
let lastTokenRefreshTime = 0;
const TOKEN_REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refresh attempts

export const refreshAccessToken = async (): Promise<{ success: boolean; accessToken?: string; reason?: string }> => {
  try {
    // Prevent too frequent token refresh attempts
    const now = Date.now();
    if (now - lastTokenRefreshTime < TOKEN_REFRESH_COOLDOWN) {
      console.warn('⚠️ Token refresh cooldown active. Skipping refresh attempt.');
      return { success: false, reason: 'Token refresh cooldown active' };
    }
    lastTokenRefreshTime = now;

    const refreshToken = localStorage.getItem('reRideRefreshToken');
    if (!refreshToken) {
      return { success: false, reason: 'No refresh token available' };
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh-token', refreshToken }),
    });

    // FIX: Immediately clear bad tokens to stop the infinite loop
    if (response.status === 401 || response.status === 400) {
      console.warn('⚠️ Session expired. Clearing tokens to prevent loop.');
      clearTokens(); 
      return { success: false, reason: 'Session expired' };
    }

    // Handle rate limiting - don't retry immediately
    if (response.status === 429) {
      console.warn('⚠️ Rate limited during token refresh. Clearing tokens to prevent loop.');
      clearTokens();
      return { success: false, reason: 'Rate limited' };
    }

    // Handle service unavailable - don't retry
    if (response.status === 503) {
      console.warn('⚠️ Service unavailable during token refresh.');
      return { success: false, reason: 'Service unavailable' };
    }

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const result = await response.json();
    
    if (result.success && result.accessToken) {
      localStorage.setItem('reRideAccessToken', result.accessToken);
      return { success: true, accessToken: result.accessToken };
    }

    return { success: false, reason: 'Invalid refresh response' };
  } catch (error) {
    console.warn('Token refresh failed:', error);
    // Optional: Clear tokens on network error to be safe
    // clearTokens(); 
    return { success: false, reason: 'Token refresh failed' };
  }
};
