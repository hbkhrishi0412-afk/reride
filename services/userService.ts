
import type { User } from '../types';
import { isDevelopmentEnvironment } from '../utils/environment';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

// Fallback mock users to prevent loading issues
const FALLBACK_USERS: User[] = [
  {
    name: 'Prestige Motors',
    email: 'seller@test.com',
    password: 'password',
    mobile: '+91-98765-43210',
    role: 'seller',
    location: 'Mumbai',
    status: 'active',
    createdAt: new Date().toISOString(),
    dealershipName: 'Prestige Motors',
    bio: 'Specializing in luxury and performance electric vehicles since 2020.',
    logoUrl: 'https://i.pravatar.cc/100?u=seller',
    avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com',
    isVerified: true,
    subscriptionPlan: 'premium',
    featuredCredits: 5,
    usedCertifications: 1
  },
  {
    name: 'Mock Customer',
    email: 'customer@test.com',
    password: 'password',
    mobile: '555-987-6543',
    role: 'customer',
    location: 'Delhi',
    status: 'active',
    createdAt: new Date().toISOString(),
    avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com'
  },
  {
    name: 'Mock Admin',
    email: 'admin@test.com',
    password: 'password',
    mobile: '111-222-3333',
    role: 'admin',
    location: 'Bangalore',
    status: 'active',
    createdAt: new Date().toISOString(),
    avatarUrl: 'https://i.pravatar.cc/150?u=admin@test.com'
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
        console.log('getUsersLocal: Starting...');
        let usersJson = localStorage.getItem('reRideUsers');
        if (!usersJson || usersJson === '[]' || usersJson === 'null') {
            console.log('getUsersLocal: No cached data or empty array, loading fallback data...');
            // Use FALLBACK_USERS directly instead of trying to import MOCK_USERS
            // MOCK_USERS might be empty in constants/index.ts
            const usersToStore = FALLBACK_USERS;
            localStorage.setItem('reRideUsers', JSON.stringify(usersToStore));
            usersJson = JSON.stringify(usersToStore);
            console.log(`✅ Populated local storage with ${usersToStore.length} users from FALLBACK_USERS`);
        } else {
            console.log('getUsersLocal: Using cached data');
            // Validate that we have users with proper structure
            const parsedUsers = JSON.parse(usersJson);
            if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) {
                console.warn('getUsersLocal: Cached data is invalid, using FALLBACK_USERS');
                const usersToStore = FALLBACK_USERS;
                localStorage.setItem('reRideUsers', JSON.stringify(usersToStore));
                usersJson = JSON.stringify(usersToStore);
            } else {
                // Ensure critical test users (seller, customer, admin) exist with correct plain text passwords
                // This fixes cases where passwords might have been incorrectly hashed or corrupted
                const criticalUsers = FALLBACK_USERS.filter(fu => 
                    ['seller@test.com', 'customer@test.com', 'admin@test.com'].includes(fu.email.toLowerCase())
                );
                
                let needsUpdate = false;
                const updatedUsers = parsedUsers.map((u: User) => {
                    const criticalUser = criticalUsers.find(cu => cu.email.toLowerCase() === (u.email || '').toLowerCase());
                    if (criticalUser) {
                        // Fix corrupted or incorrectly stored passwords
                        const storedPassword = (u.password || '').trim();
                        const expectedPassword = criticalUser.password.trim();
                        
                        // Check if password needs to be fixed:
                        // 1. Password is hashed (starts with $2) - should be plain text in development
                        // 2. Password is empty or missing
                        // 3. Password doesn't match expected plain text value
                        // 4. Password is corrupted (contains invalid characters or wrong length)
                        const isHashed = storedPassword.startsWith('$2');
                        const isEmpty = !storedPassword || storedPassword.length === 0;
                        const isMismatched = storedPassword !== expectedPassword;
                        const isCorrupted = storedPassword.length > 100 || storedPassword.includes('\n') || storedPassword.includes('\r');
                        
                        if (isHashed || isEmpty || isMismatched || isCorrupted) {
                            const reason = isHashed ? 'hashed' : isEmpty ? 'empty' : isCorrupted ? 'corrupted' : 'mismatched';
                            console.warn(`⚠️ getUsersLocal: Fixing ${reason} password for ${u.email} - resetting to plain text`);
                            needsUpdate = true;
                            // Reset to fallback user data to ensure all fields are correct
                            return { ...criticalUser, ...u, password: expectedPassword };
                        }
                    }
                    return u;
                });
                
                // Add any missing critical users
                criticalUsers.forEach(criticalUser => {
                    const exists = updatedUsers.some((u: User) => 
                        (u.email || '').toLowerCase() === criticalUser.email.toLowerCase()
                    );
                    if (!exists) {
                        console.warn(`⚠️ getUsersLocal: Missing critical user ${criticalUser.email} - adding from fallback`);
                        needsUpdate = true;
                        updatedUsers.push(criticalUser);
                    }
                });
                
                if (needsUpdate) {
                    console.log('✅ getUsersLocal: Fixed corrupted user data in localStorage');
                    localStorage.setItem('reRideUsers', JSON.stringify(updatedUsers));
                    usersJson = JSON.stringify(updatedUsers);
                } else {
                    usersJson = JSON.stringify(updatedUsers);
                }
            }
        }
        const users = JSON.parse(usersJson);
        console.log('getUsersLocal: Successfully loaded', users.length, 'users');
        // Log available emails for debugging
        console.log('getUsersLocal: Available user emails:', users.map((u: User) => u.email));
        return users;
    } catch (error) {
        console.error('getUsersLocal: Error loading users:', error);
        // Return FALLBACK_USERS as fallback
        console.log('getUsersLocal: Returning FALLBACK_USERS as fallback');
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
        console.log('🔐 Password updated - clearing session cache to force fresh authentication');
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
    credentials: any & { skipRoleCheck?: boolean }
): Promise<{ success: boolean, user?: User, reason?: string, detectedRole?: string }> => {
    const { email, password, role, skipRoleCheck } = credentials;
    
    // Normalize email (trim and lowercase for comparison)
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPassword = (password || '').trim();
    
    console.log('🔐 loginLocal: Attempting login', { 
        email: normalizedEmail, 
        passwordLength: normalizedPassword.length,
        role 
    });
    
    // CRITICAL FIX: Warn if using cached data - password might be stale
    console.warn('⚠️ loginLocal: Using localStorage cache - if password was recently updated, this may fail. Clear cache and try again.');
    
    const users = await getUsersLocal();
    
    // Find user by email (case-insensitive comparison)
    const user = users.find(u => (u.email || '').trim().toLowerCase() === normalizedEmail);
    
    if (!user) {
        console.log('❌ loginLocal: User not found', { email: normalizedEmail, availableEmails: users.map(u => u.email) });
        return { success: false, reason: 'Invalid credentials.' };
    }
    
    console.log('✅ loginLocal: User found', { email: user.email, hasPassword: !!user.password });
    
    // SECURITY: For local storage in development, we use plain text comparison
    // localStorage is for development/testing only - in production, use API with proper password hashing
    let isPasswordValid = false;
    
    const storedPassword = (user.password || '').trim();
    
    // In development mode with localStorage, passwords should be stored as plain text
    // If password looks like a bcrypt hash, it might have been incorrectly stored
    // We'll try bcrypt comparison first, but fall back to plain text if it fails
    if (storedPassword.startsWith('$2')) {
        // Password appears to be hashed - try bcrypt comparison if available
        try {
            // Use dynamic import for browser compatibility
            const bcryptModule = await import('bcryptjs');
            const bcrypt = bcryptModule.default || bcryptModule;
            isPasswordValid = await bcrypt.compare(normalizedPassword, storedPassword);
            console.log('🔍 loginLocal: Bcrypt comparison result', { isValid: isPasswordValid });
        } catch (error) {
            // Bcrypt not available or comparison failed - this is expected in browser
            // For development localStorage, we should use plain text
            console.warn('⚠️ loginLocal: Bcrypt unavailable in browser - this is normal for localStorage mode');
            // Cannot compare hashed password without bcrypt, so fail
            isPasswordValid = false;
        }
    } else {
        // Plain text password - direct comparison (development mode only)
        isPasswordValid = storedPassword === normalizedPassword;
        console.log('🔍 loginLocal: Plain text comparison', { 
            storedPasswordLength: storedPassword.length,
            inputPasswordLength: normalizedPassword.length,
            storedPassword: storedPassword.substring(0, 3) + '***', // Only show first 3 chars for security
            match: isPasswordValid 
        });
    }
    
    if (!isPasswordValid) {
        console.log('❌ loginLocal: Password mismatch');
        console.warn('💡 TIP: If you recently updated the password, clear localStorage cache: localStorage.removeItem("reRideUsers")');
        return { success: false, reason: 'Invalid credentials.' };
    }
    
    if (!skipRoleCheck && role && user.role !== role) {
        console.log('❌ loginLocal: Role mismatch', { expected: role, actual: user.role });
        // Provide helpful error message that suggests the correct role
        return { 
            success: false, 
            reason: `This account is registered as a ${user.role}. Please select "${user.role.charAt(0).toUpperCase() + user.role.slice(1)}" as your account type.`,
            detectedRole: user.role // Include detected role for UI to use
        };
    }
    
    if (user.status === 'inactive') {
        console.log('❌ loginLocal: Account inactive');
        return { success: false, reason: 'Your account has been deactivated.' };
    }
    
    console.log('✅ loginLocal: Login successful', { email: user.email, role: user.role });
    
    // SECURITY: Remove password from response
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

const getUsersApi = async (): Promise<User[]> => {
  // Use authenticatedFetch for production API calls
  try {
    const { authenticatedFetch } = await import('../utils/authenticatedFetch');
    const response = await authenticatedFetch('/api/users');
    return handleResponse(response);
  } catch (error) {
    // If authenticatedFetch fails, try regular fetch (for development)
    const response = await fetch('/api/users', {
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
    
    // CRITICAL FIX: Clear cache when password is updated to force fresh login
    if (passwordWasUpdated) {
        console.log('🔐 Password updated via API - clearing localStorage cache to force fresh authentication');
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

const authApi = async (body: any, retryCount = 0): Promise<any> => {
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
            
            // Handle service unavailable (503) - use fallback, don't retry
            if (response.status === 503) {
                console.warn('⚠️ Service unavailable (503). Using fallback mechanism.');
                throw new Error('Service temporarily unavailable. Please try again later.');
            }
            
            // Handle other 5xx errors - use fallback
            if (response.status >= 500 && response.status < 600) {
                console.warn(`⚠️ Server error (${response.status}). Using fallback mechanism.`);
                throw new Error(`Server error (${response.status}). Please try again later.`);
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

export const getUsers = async (): Promise<User[]> => {
  try {
    console.log('getUsers: Starting, isDevelopment:', isDevelopment);
    // Always try API first for production, with fallback to local
    if (!isDevelopment) {
      try {
        console.log('getUsers: Trying API...');
        const result = await getUsersApi();
        console.log('getUsers: API success, loaded', result.length, 'users');
        // Cache production data (not mock data)
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('reRideUsers_prod', JSON.stringify(result));
        }
        return result;
      } catch (error) {
        console.error('❌ getUsers: Production API failed:', error);
        // In production, try to use cached API data (not mock data)
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          try {
            const cachedUsersJson = localStorage.getItem('reRideUsers_prod');
            if (cachedUsersJson) {
              const cachedUsers = JSON.parse(cachedUsersJson);
              if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
                console.warn('⚠️ getUsers: Using cached production data due to API failure');
                return cachedUsers;
              }
            }
          } catch (cacheError) {
            console.error('Failed to load cached production data:', cacheError);
          }
        }
        // If no cached data, return empty array (don't use mock data in production)
        console.error('❌ getUsers: No cached production data available, returning empty array');
        return [];
      }
    } else {
      // Development mode - use local storage
      console.log('getUsers: Development mode, using local storage');
      return await getUsersLocal();
    }
  } catch (error) {
    console.error('getUsers: Critical error:', error);
    // In production, return empty array instead of fallback users
    if (!isDevelopment) {
      return [];
    }
    // Last resort fallback only in development
    return FALLBACK_USERS;
  }
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
export const login = async (credentials: any): Promise<{ success: boolean, user?: User, reason?: string }> => {
  console.log('🚀 Login attempt:', { email: credentials.email, role: credentials.role, isDevelopment, hostname: window.location.hostname, port: window.location.port });
  
  // Validate required fields before making API request
  if (!credentials.email || (typeof credentials.email === 'string' && credentials.email.trim() === '')) {
    return { success: false, reason: 'Email is required.' };
  }
  if (!credentials.password || (typeof credentials.password === 'string' && credentials.password.trim() === '')) {
    return { success: false, reason: 'Password is required.' };
  }
  
  // Always use local storage in development or on localhost
  // Only try API in true production environments
  if (!isDevelopment) {
    try {
      console.log('🌐 Trying API login...', { 
        email: credentials.email, 
        role: credentials.role,
        endpoint: '/api/users'
      });
      const result = await authApi({ action: 'login', ...credentials });
      
      // Validate API response structure
      if (!result || typeof result !== 'object') {
        console.error('❌ Invalid API response structure:', result);
        throw new Error('Invalid response from server');
      }
      
      if (!result.success) {
        console.warn('⚠️ API login failed:', result.reason);
        
        // If role mismatch, try to auto-detect by trying without role or with alternate roles
        if (result.reason && result.reason.includes('not a registered')) {
          console.log('🔄 Role mismatch detected, attempting to auto-detect user role...');
          
          // Try login without role specification to let backend determine it
          try {
            const autoDetectResult = await authApi({ 
              action: 'login', 
              email: credentials.email, 
              password: credentials.password 
              // Don't include role - let backend determine it
            });
            
            if (autoDetectResult.success && autoDetectResult.user) {
              console.log('✅ Auto-detected role:', autoDetectResult.user.role);
              
              // Store tokens if provided
              if (autoDetectResult.accessToken && autoDetectResult.refreshToken) {
                storeTokens(autoDetectResult.accessToken, autoDetectResult.refreshToken);
                localStorage.setItem('reRideCurrentUser', JSON.stringify(autoDetectResult.user));
              }
              
              return autoDetectResult;
            }
          } catch (autoDetectError) {
            console.warn('⚠️ Auto-detection failed, returning original error');
          }
        }
        
        return result;
      }
      
      // Validate user object structure (critical for seller dashboard)
      if (!result.user) {
        console.error('❌ API response missing user object:', result);
        throw new Error('User data not received from server');
      }
      
      if (!result.user.email || !result.user.role) {
        console.error('❌ API user object missing required fields:', {
          hasEmail: !!result.user.email,
          hasRole: !!result.user.role,
          userObject: result.user
        });
        throw new Error('Invalid user data received from server');
      }
      
      // Verify role matches requested role
      if (credentials.role && result.user.role !== credentials.role) {
        console.warn('⚠️ Role mismatch in API response:', {
          requested: credentials.role,
          received: result.user.role,
          email: result.user.email
        });
      }
      
      // Store JWT tokens if provided
      if (result.accessToken && result.refreshToken) {
        storeTokens(result.accessToken, result.refreshToken);
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
        console.log('✅ Tokens stored successfully');
      }
      
      console.log('✅ API login successful:', {
        email: result.user.email,
        role: result.user.role,
        userId: result.user.id
      });
      return result;
    } catch (error) {
      // Check if it's a network/server error (should fallback) vs invalid credentials
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('fetch') || 
                             errorMessage.includes('network') || 
                             errorMessage.includes('Failed to fetch') ||
                             errorMessage.includes('CORS') ||
                             errorMessage.includes('500') ||
                             errorMessage.includes('503') ||
                             errorMessage.includes('502') ||
                             errorMessage.includes('504') ||
                             errorMessage.includes('429') ||
                             errorMessage.includes('Too many requests') ||
                             errorMessage.includes('Service temporarily unavailable');
      
      // If it's a network/server error, fallback to local storage immediately
      // BUT: Don't fallback for "Invalid credentials" - this means password is wrong in database
      // Only fallback for actual network/server errors
      if (isNetworkError) {
        console.warn('⚠️  API login failed due to network error, falling back to local storage:', errorMessage);
        try {
          const localResult = await loginLocal({ ...credentials, skipRoleCheck: true });
          if (localResult.success) {
            console.log('✅ Local storage login successful (fallback)');
            return localResult;
          } else {
            // Local storage also failed - return the original API error
            console.warn('⚠️  Local storage login also failed');
            return { success: false, reason: 'Login failed. Please check your connection and try again.' };
          }
        } catch (localError) {
          console.error('❌ Local storage login error:', localError);
          return { success: false, reason: 'Login failed. Please check your connection and try again.' };
        }
      } else {
        // Other errors (including Invalid credentials) - return the error message
        // Don't fallback to localStorage for invalid credentials - password was updated in DB
        return { success: false, reason: errorMessage };
      }
    }
  } else {
    // Development mode - use local storage directly
    console.log('💻 Development mode - using local storage directly');
    
    // First try with role check to detect mismatches
    const result = await loginLocal({ ...credentials, skipRoleCheck: false });
    
    // If role mismatch, return result with detected role hint
    if (!result.success && result.reason && result.reason.includes('registered as')) {
      return result; // Return the helpful error message
    }
    
    // If credentials are wrong, return as-is
    if (!result.success) {
      return result;
    }
    
    // Success - return result
    return result;
  }
};
export const register = async (credentials: any): Promise<{ success: boolean, user?: User, reason?: string }> => {
  console.log('🚀 Register attempt:', { email: credentials.email, role: credentials.role, isDevelopment });
  
  // Validate required fields before making API request
  if (!credentials.email || (typeof credentials.email === 'string' && credentials.email.trim() === '')) {
    return { success: false, reason: 'Email is required.' };
  }
  if (!credentials.password || (typeof credentials.password === 'string' && credentials.password.trim() === '')) {
    return { success: false, reason: 'Password is required.' };
  }
  if (!credentials.name || (typeof credentials.name === 'string' && credentials.name.trim() === '')) {
    return { success: false, reason: 'Name is required.' };
  }
  if (!credentials.mobile || (typeof credentials.mobile === 'string' && credentials.mobile.trim() === '')) {
    return { success: false, reason: 'Mobile number is required.' };
  }
  if (!credentials.role || (typeof credentials.role === 'string' && credentials.role.trim() === '')) {
    return { success: false, reason: 'Role is required.' };
  }
  
  // Always try API first for production, with fallback to local
  if (!isDevelopment) {
    try {
      console.log('🌐 Trying API registration...');
      const result = await authApi({ action: 'register', ...credentials });
      
      // Store JWT tokens if provided
      if (result.success && result.accessToken && result.refreshToken) {
        storeTokens(result.accessToken, result.refreshToken);
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
      }
      
      console.log('✅ API registration successful');
      return result;
    } catch (error) {
      console.warn('⚠️  API registration failed, falling back to local storage:', error);
      // Fallback to local storage if API fails
      return await registerLocal(credentials);
    }
  } else {
    // Development mode - use local storage
    console.log('💻 Development mode - using local storage');
    return await registerLocal(credentials);
  }
};

export const logout = (): void => {
  clearTokens();
  console.log('✅ User logged out and tokens cleared');
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
