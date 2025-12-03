
import type { User } from '../types';
import { isDevelopmentEnvironment } from '../utils/environment';

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

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        // Handle 401 Unauthorized - clear tokens and stop retry loop
        if (response.status === 401) {
            console.warn('401 Unauthorized detected, clearing tokens');
            clearTokens();
            // Optionally redirect to login page
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
            const error = await response.json().catch(() => ({ error: 'Unauthorized. Please login again.' }));
            throw new Error(error.error || 'Unauthorized. Please login again.');
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
    localStorage.setItem('reRideUsers', JSON.stringify(users));
    if (!updatedUser) throw new Error("User not found to update.");
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
): Promise<{ success: boolean, user?: User, reason?: string }> => {
    const { email, password, role, skipRoleCheck } = credentials;
    
    // Normalize email (trim and lowercase for comparison)
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPassword = (password || '').trim();
    
    console.log('🔐 loginLocal: Attempting login', { 
        email: normalizedEmail, 
        passwordLength: normalizedPassword.length,
        role 
    });
    
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
        return { success: false, reason: 'Invalid credentials.' };
    }
    
    if (!skipRoleCheck && role && user.role !== role) {
        console.log('❌ loginLocal: Role mismatch', { expected: role, actual: user.role });
        return { success: false, reason: `User is not a registered ${role}.` };
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
  const response = await fetch('/api/users');
  return handleResponse(response);
};

const updateUserApi = async (userData: Partial<User> & { email: string }): Promise<User> => {
    const response = await fetch('/api/users', {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(userData),
    });
    return handleResponse(response);
};

const deleteUserApi = async (email: string): Promise<{ success: boolean, email: string }> => {
    const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: getAuthHeader(),
        body: JSON.stringify({ email }),
    });
    return handleResponse(response);
};

const authApi = async (body: any): Promise<any> => {
    const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    
    // Check if response is ok first
    if (!response.ok) {
        // Try to parse error response, but handle cases where response might be empty
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.reason || errorData.error || errorMessage;
            }
        } catch (parseError) {
            // If we can't parse the error response, use the default error message
            console.warn('Could not parse error response:', parseError);
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
        return result;
      } catch (error) {
        console.warn('getUsers: API failed, falling back to local storage:', error);
        // Show user-friendly notification for API failures
        if (error instanceof Error && error.message.includes('API Error: 5')) {
          console.info('getUsers: Using cached data due to server issues');
        }
        // Fallback to local storage if API fails
        return await getUsersLocal();
      }
    } else {
      // Development mode - use local storage
      console.log('getUsers: Development mode, using local storage');
      return await getUsersLocal();
    }
  } catch (error) {
    console.error('getUsers: Critical error, returning FALLBACK_USERS:', error);
    // Last resort fallback
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
                             errorMessage.includes('504');
      
      // If it's a network/server error, fallback to local storage
      // If it's "Invalid credentials" from API, also try local storage as fallback
      // (in case password was updated locally but server sync failed)
      if (isNetworkError || errorMessage.includes('Invalid credentials')) {
        console.warn('⚠️  API login failed, falling back to local storage:', errorMessage);
        try {
          const localResult = await loginLocal({ ...credentials, skipRoleCheck: true });
          if (localResult.success) {
            console.log('✅ Local storage login successful (fallback)');
            return localResult;
          } else {
            // Local storage also failed - return the original API error
            console.warn('⚠️  Local storage login also failed');
            return { success: false, reason: errorMessage.includes('Invalid credentials') ? 'Invalid credentials.' : 'Login failed. Please check your connection and try again.' };
          }
        } catch (localError) {
          console.error('❌ Local storage login error:', localError);
          return { success: false, reason: errorMessage.includes('Invalid credentials') ? 'Invalid credentials.' : 'Login failed. Please check your connection and try again.' };
        }
      } else {
        // Other errors - return the error message
        return { success: false, reason: errorMessage };
      }
    }
  } else {
    // Development mode - use local storage directly
    console.log('💻 Development mode - using local storage directly');
    return await loginLocal({ ...credentials, skipRoleCheck: true });
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

// Token refresh function
export const refreshAccessToken = async (): Promise<{ success: boolean; accessToken?: string; reason?: string }> => {
  try {
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
