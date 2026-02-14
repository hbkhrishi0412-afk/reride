import type { Vehicle, User, VehicleData } from '../types';
import { queueRequest } from '../utils/requestQueue';

// Unified data service that handles both local and API data consistently
class DataService {
  private isDevelopment: boolean;
  private apiBaseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly RATE_LIMIT_CACHE_DURATION = 60 * 1000; // 1 minute cache for rate-limited responses

  constructor() {
    this.isDevelopment = this.detectDevelopment();
    this.apiBaseUrl = '/api';
  }

  private detectDevelopment(): boolean {
    try {
      // Safe check for import.meta.env
      // In Jest/CJS environments import.meta might not exist or have env
      const meta = (typeof import.meta !== 'undefined' ? import.meta : {}) as any;
      
      if (meta && meta.env) {
        if (meta.env.VITE_FORCE_API === 'true') {
          return false;
        }
        if (meta.env.DEV) {
          return true;
        }
      }
      
      const hostname = typeof window !== 'undefined' ? (window.location?.hostname ?? '') : '';
      const isLocalhost = hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.includes('localhost');
      
      const protocol = typeof window !== 'undefined' ? (window.location?.protocol ?? '') : '';

      return isLocalhost || protocol === 'file:';
    } catch {
      return false;
    }
  }

  private async makeApiRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    priority: number = 5
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const shouldSendJson = method !== 'GET' && method !== 'HEAD';

    // Use request queue to prevent rate limiting
    // Higher priority for GET requests (read operations are more critical)
    const requestPriority = method === 'GET' ? Math.max(priority, 7) : priority;
    
    return queueRequest(
      async () => {
        const headers: HeadersInit = {
          Accept: 'application/json',
          ...(shouldSendJson ? { 'Content-Type': 'application/json' } : {}),
          ...this.getAuthHeaders(),
          ...(options.headers || {})
        };

        const fetchOptions: RequestInit = {
          ...options,
          method,
          headers,
          credentials: 'include'
        };

        // Check cache for GET requests
        const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
        if (method === 'GET') {
          const cached = this.cache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            // Return cached data immediately to avoid redundant API calls
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ Using cached data for ${endpoint}`);
            }
            return cached.data;
          }
        }

        // Helper: perform fetch with timeout so we can retry after token refresh
        const performFetch = async (): Promise<Response> => {
          let timeoutId: NodeJS.Timeout | null = null;
          try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout for faster fallback

            const resp = await fetch(`${this.apiBaseUrl}${endpoint}`, {
              ...fetchOptions,
              signal: controller.signal
            });

            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            return resp;
          } catch (fetchError) {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('aborted'))) {
              throw new Error('API request timeout');
            }
            throw new Error('Network error: Unable to reach API server');
          }
        };

        let response: Response = await performFetch();

        // If the access token expired, try one refresh + retry before failing
        if (response.status === 401) {
          try {
            const { refreshAccessToken } = await import('./userService');
            const refreshResult = await refreshAccessToken();
            if (refreshResult.success && refreshResult.accessToken) {
              headers['Authorization'] = `Bearer ${refreshResult.accessToken}`;
              response = await performFetch();
            }
          } catch (authError) {
            console.warn('⚠️ Token refresh during API request failed:', authError);
          }
        }

        if (!response.ok) {
          // Handle rate limiting (429) specially
          if (response.status === 429) {
            const errorText = await response.text();
            let errorMessage = 'Too many requests. Please wait a moment and try again.';
            
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.reason || errorData.error || errorMessage;
            } catch {
              // Use default error message if JSON parsing fails
            }
            
            // Throw error with status code for request queue to handle
            const error: any = new Error(errorMessage);
            error.status = 429;
            error.code = 429;
            throw error;
          }
          
          // For 404 errors in development, fail silently and let fallback handle it
          if (response.status === 404 && this.isDevelopment) {
            throw new Error('API endpoint not found (expected in development)');
          }
          
          const errorText = await response.text();
          let errorMessage = `API Error: ${response.status} - ${response.statusText}`;
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.reason || errorMessage;
          } catch {
            // Use default error message if JSON parsing fails
          }
          
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Unexpected non-JSON response from API:', text.slice(0, 300));
          if (text.includes('Authentication Required') || text.includes('Vercel Authentication')) {
            throw new Error('Authentication is required to access the API. Please ensure the deployment protection bypass cookie is set.');
          }
          throw new Error('Unexpected response from server. Expected JSON but received a different format.');
        }

        const data = await response.json();
        
        // Cache GET requests
        if (method === 'GET') {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }
        
        return data;
      },
      {
        priority: requestPriority,
        id: `${method}_${endpoint}`,
        maxRetries: method === 'GET' ? 2 : 1
      }
    );
  }

  private getAuthHeaders(): Record<string, string> {
    try {
      // Check if user has access token (required for production)
      const accessToken = localStorage.getItem('reRideAccessToken') || sessionStorage.getItem('accessToken');
      if (accessToken) {
        return { 'Authorization': `Bearer ${accessToken}` };
      }
      
      // In production, we must have a token - return empty headers to trigger 401
      // This will cause the API to return 401, which will trigger fallback to local storage
      // In development, we can proceed without token (localStorage mode)
      if (!this.isDevelopment) {
        console.warn('⚠️ No access token found in production - API calls will fail and fallback to local storage');
      }
      
      return {};
    } catch (error) {
      console.error('Failed to get auth headers:', error);
      return {};
    }
  }

  private getLocalStorageData<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (error) {
      console.warn(`Failed to parse localStorage data for ${key}:`, error);
      return fallback;
    }
  }

  private setLocalStorageData<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save data to localStorage for ${key}:`, error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Clear old data and try again
        this.clearOldData();
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (retryError) {
          console.error(`Failed to save data after clearing old data:`, retryError);
        }
      }
    }
  }

  private clearOldData(): void {
    const keysToKeep = ['reRideCurrentUser', 'wishlist', 'comparisonList'];
    const allKeys = Object.keys(localStorage);
    
    for (const key of allKeys) {
      if (!keysToKeep.includes(key) && key.startsWith('reRide')) {
        localStorage.removeItem(key);
      }
    }
  }

  // Vehicle operations
  async getVehicles(includeAllStatuses: boolean = false): Promise<Vehicle[]> {
    if (this.isDevelopment) {
      return this.getVehiclesLocal();
    }

    // STEP 1: Check cache first for instant response
    const cacheKey = 'reRideVehicles_prod';
    const cachedVehicles = this.getLocalStorageData<Vehicle[]>(cacheKey, []);
    
      // If we have cached data, return it immediately and fetch fresh data in background
      if (cachedVehicles.length > 0) {
        // Fetch fresh data in background (don't await) - use pagination for speed
        // IMPORTANT: Refresh full dataset in background to avoid replacing cache with a partial page.
        const endpoint = includeAllStatuses ? '/vehicles?action=admin-all' : '/vehicles?limit=0&skipExpiryCheck=true';
        this.makeApiRequest<Vehicle[] | { vehicles: Vehicle[]; pagination?: any }>(endpoint)
          .then(response => {
            // Handle both array response (limit=0) and paginated response (limit>0)
            let vehicles: Vehicle[];
            if (Array.isArray(response)) {
              vehicles = response;
            } else if (response && typeof response === 'object' && 'vehicles' in response) {
              vehicles = response.vehicles || [];
            } else {
              console.warn('⚠️ Invalid background refresh response format:', response);
              return;
            }
            
            if (Array.isArray(vehicles) && vehicles.length > 0) {
              this.setLocalStorageData(cacheKey, vehicles);
              console.log(`✅ Background refresh: Updated cache with ${vehicles.length} vehicles`);
            } else if (vehicles.length === 0) {
              console.warn('⚠️ Background refresh returned 0 vehicles. Keeping cached data.');
            }
          })
        .catch(error => {
          console.warn('Background vehicle refresh failed (using cache):', error);
        });
      
      // Return cached data immediately
      console.log(`✅ Returning ${cachedVehicles.length} cached vehicles instantly`);
      return cachedVehicles;
    }

    // STEP 2: No cache - fetch from API (first load or cache expired)
    // Use limit=0 to get all vehicles (backward compatible, still fast with optimizations)
    try {
      // Use limit=0 to get all vehicles as array (not paginated object)
      const endpoint = includeAllStatuses ? '/vehicles?action=admin-all' : '/vehicles?limit=0&skipExpiryCheck=true';
      const response = await this.makeApiRequest<Vehicle[] | { vehicles: Vehicle[]; pagination?: any }>(endpoint);
      
      // Handle both array response (limit=0) and paginated response (limit>0)
      let vehicles: Vehicle[];
      if (Array.isArray(response)) {
        vehicles = response;
      } else if (response && typeof response === 'object' && 'vehicles' in response) {
        vehicles = response.vehicles || [];
      } else {
        console.error('❌ Invalid response format:', response);
        throw new Error('Invalid response format: expected array or object with vehicles property');
      }
      
      if (!Array.isArray(vehicles)) {
        console.error('❌ Invalid response format: expected array, got:', typeof vehicles);
        throw new Error('Invalid response format: expected array');
      }
      
      console.log(`✅ Loaded ${vehicles.length} vehicles from production API (response type: ${Array.isArray(response) ? 'array' : 'paginated'})`);
      
      if (vehicles.length === 0) {
        console.warn('⚠️ API returned 0 vehicles. Check if there are published vehicles in the database.');
      }
      
      // Cache the API data
      this.setLocalStorageData(cacheKey, vehicles);
      return vehicles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Production API failed to load vehicles:', errorMessage);
      
      // Check for specific error types to provide better diagnostics
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Network error')) {
        console.error('💡 API Server Connection Issue:');
        console.error('   The API server may not be running.');
        console.error('   Solution: Start the API server with: npm run dev:api');
      } else if (errorMessage.includes('timeout')) {
        console.error('💡 API Request Timeout:');
        console.error('   The API server is not responding in time.');
        console.error('   Solution: Check if API server is running and responsive');
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        console.error('💡 Authentication Issue:');
        console.error('   Authentication may be required or token expired.');
        console.error('   Solution: Try logging in again');
      }
      
      // Return cached data if available (even if stale)
      if (cachedVehicles.length > 0) {
        console.warn(`⚠️ Using stale cached data (${cachedVehicles.length} vehicles) due to API failure`);
        return cachedVehicles;
      }
      
      // If no cached data, log detailed error and return empty array
      console.error('❌ No cached production data available. API error details:', {
        message: errorMessage,
        endpoint: includeAllStatuses ? '/vehicles?action=admin-all' : '/vehicles',
        timestamp: new Date().toISOString()
      });
      
      // Show user-friendly error in console (won't break the app)
      if (typeof window !== 'undefined') {
        console.error('💡 Troubleshooting:');
        console.error('   1. Check if API server is running: npm run dev:api');
        console.error('   2. Check if Firebase is properly configured');
        console.error('   3. Verify /api/vehicles endpoint is working');
        console.error('   4. Check browser network tab for API errors');
        console.error('   5. Ensure database is seeded with vehicles');
        console.error('   6. Run diagnostic: node scripts/diagnose-issues.js');
      }
      
      return [];
    }
  }

  private async getVehiclesLocal(): Promise<Vehicle[]> {
    const fallbackVehicles: Vehicle[] = [{
      id: 1,
      make: "Maruti Suzuki",
      model: "Swift",
      year: 2022,
      price: 650000,
      mileage: 18000,
      fuelType: "Petrol",
      transmission: "Manual",
      city: "Mumbai",
      state: "MH",
      location: "Mumbai, MH",
      sellerEmail: "demo@reride.com",
      images: ["https://picsum.photos/800/600?random=1"],
      description: "Well maintained Swift in excellent condition",
      status: "published",
      isFeatured: true,
      views: 150,
      inquiriesCount: 8,
      certificationStatus: "none",
      category: "FOUR_WHEELER" as any,
      features: [],
      engine: "1.2L",
      fuelEfficiency: "20 kmpl",
      color: "White",
      registrationYear: 2022,
      insuranceValidity: "2025-01-01",
      insuranceType: "Comprehensive",
      rto: "MH-01",
      noOfOwners: 1,
      displacement: "1197 cc",
      groundClearance: "170 mm",
      bootSpace: "268 litres"
    }];

    let vehicles = this.getLocalStorageData<Vehicle[]>('reRideVehicles', []);
    
    if (vehicles.length === 0) {
      try {
        // Try to load mock data first
        const mockVehicles = await import('../mock-vehicles.json');
        if (mockVehicles.default && mockVehicles.default.length > 0) {
          vehicles = mockVehicles.default as Vehicle[];
          this.setLocalStorageData('reRideVehicles', vehicles);
          console.log('✅ Loaded mock vehicles data:', vehicles.length, 'vehicles');
        } else {
          // Fallback to constants if mock data not available
          const { MOCK_VEHICLES } = await import('../constants.js');
          vehicles = await MOCK_VEHICLES();
          this.setLocalStorageData('reRideVehicles', vehicles);
        }
      } catch (error) {
        console.log('⚠️ Could not load mock vehicles, using fallback:', error);
        vehicles = fallbackVehicles;
        this.setLocalStorageData('reRideVehicles', vehicles);
      }
    }

    return vehicles;
  }

  async addVehicle(vehicleData: Vehicle): Promise<Vehicle> {
    if (this.isDevelopment) {
      return this.addVehicleLocal(vehicleData);
    }

    try {
      const vehicle = await this.makeApiRequest<Vehicle>('/vehicles', {
        method: 'POST',
        body: JSON.stringify(vehicleData),
      });
      
      // Update local cache (use production cache key in production)
      if (this.isDevelopment) {
        const vehicles = await this.getVehiclesLocal();
        vehicles.unshift(vehicle);
        this.setLocalStorageData('reRideVehicles', vehicles);
      } else {
        const cachedVehicles = this.getLocalStorageData<Vehicle[]>('reRideVehicles_prod', []);
        cachedVehicles.unshift(vehicle);
        this.setLocalStorageData('reRideVehicles_prod', cachedVehicles);
      }
      
      console.log('✅ Vehicle added successfully via API:', vehicle.id);
      return vehicle;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to add vehicle via API:', errorMessage);
      
      // In production, don't silently fall back to local storage
      // This would create a mismatch between Firebase and local storage
      if (errorMessage.includes('Authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
        throw new Error('Authentication required. Please log in and try again.');
      }
      
      // For other errors, still throw to show the error to the user
      throw new Error(`Failed to add vehicle: ${errorMessage}`);
    }
  }

  private async addVehicleLocal(vehicleData: Vehicle): Promise<Vehicle> {
    // Use production cache key in production, dev key in development
    const cacheKey = this.isDevelopment ? 'reRideVehicles' : 'reRideVehicles_prod';
    const vehicles = this.getLocalStorageData<Vehicle[]>(cacheKey, []);
    vehicles.unshift(vehicleData);
    this.setLocalStorageData(cacheKey, vehicles);
    return vehicleData;
  }

  async updateVehicle(vehicleData: Vehicle): Promise<Vehicle> {
    if (this.isDevelopment) {
      return this.updateVehicleLocal(vehicleData);
    }

    try {
      const vehicle = await this.makeApiRequest<Vehicle>('/vehicles', {
        method: 'PUT',
        body: JSON.stringify(vehicleData),
      });
      
      // Update local cache (use production cache key in production)
      if (this.isDevelopment) {
        const vehicles = await this.getVehiclesLocal();
        const updatedVehicles = vehicles.map(v => v.id === vehicleData.id ? vehicle : v);
        this.setLocalStorageData('reRideVehicles', updatedVehicles);
      } else {
        const cachedVehicles = this.getLocalStorageData<Vehicle[]>('reRideVehicles_prod', []);
        const updatedVehicles = cachedVehicles.map(v => v.id === vehicleData.id ? vehicle : v);
        this.setLocalStorageData('reRideVehicles_prod', updatedVehicles);
      }
      
      console.log('✅ Vehicle updated successfully via API:', vehicle.id);
      return vehicle;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to update vehicle via API:', errorMessage);
      
      // In production, don't silently fall back to local storage
      if (errorMessage.includes('Authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
        throw new Error('Authentication required. Please log in and try again.');
      }
      
      throw new Error(`Failed to update vehicle: ${errorMessage}`);
    }
  }

  private async updateVehicleLocal(vehicleData: Vehicle): Promise<Vehicle> {
    // Use production cache key in production, dev key in development
    const cacheKey = this.isDevelopment ? 'reRideVehicles' : 'reRideVehicles_prod';
    const vehicles = this.getLocalStorageData<Vehicle[]>(cacheKey, []);
    const updatedVehicles = vehicles.map(v => v.id === vehicleData.id ? vehicleData : v);
    this.setLocalStorageData(cacheKey, updatedVehicles);
    return vehicleData;
  }

  async deleteVehicle(vehicleId: number): Promise<{ success: boolean, id: number }> {
    if (this.isDevelopment) {
      return this.deleteVehicleLocal(vehicleId);
    }

    try {
      const result = await this.makeApiRequest<{ success: boolean, id: number }>('/vehicles', {
        method: 'DELETE',
        body: JSON.stringify({ id: vehicleId }),
      });
      
      // Update local cache (use production cache key in production)
      if (this.isDevelopment) {
        const vehicles = await this.getVehiclesLocal();
        const filteredVehicles = vehicles.filter(v => v.id !== vehicleId);
        this.setLocalStorageData('reRideVehicles', filteredVehicles);
      } else {
        const cachedVehicles = this.getLocalStorageData<Vehicle[]>('reRideVehicles_prod', []);
        const filteredVehicles = cachedVehicles.filter(v => v.id !== vehicleId);
        this.setLocalStorageData('reRideVehicles_prod', filteredVehicles);
      }
      
      console.log('✅ Vehicle deleted successfully via API:', vehicleId);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to delete vehicle via API:', errorMessage);
      
      // In production, don't silently fall back to local storage
      if (errorMessage.includes('Authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
        throw new Error('Authentication required. Please log in and try again.');
      }
      
      throw new Error(`Failed to delete vehicle: ${errorMessage}`);
    }
  }

  private async deleteVehicleLocal(vehicleId: number): Promise<{ success: boolean, id: number }> {
    // Use production cache key in production, dev key in development
    const cacheKey = this.isDevelopment ? 'reRideVehicles' : 'reRideVehicles_prod';
    const vehicles = this.getLocalStorageData<Vehicle[]>(cacheKey, []);
    const filteredVehicles = vehicles.filter(v => v.id !== vehicleId);
    this.setLocalStorageData(cacheKey, filteredVehicles);
    return { success: true, id: vehicleId };
  }

  // User operations
  async getUsers(): Promise<User[]> {
    if (this.isDevelopment) {
      return this.getUsersLocal();
    }

    try {
      // Check if we have an access token before making the request
      const accessToken = localStorage.getItem('reRideAccessToken') || sessionStorage.getItem('accessToken');
      if (!accessToken) {
        console.warn('⚠️ No access token found. Cannot fetch users from API.');
        // Try to use cached data
        const cachedUsers = this.getLocalStorageData<User[]>('reRideUsers_prod', []);
        if (cachedUsers.length > 0) {
          console.warn('⚠️ Using cached users data (no token available)');
          return cachedUsers;
        }
        return [];
      }

      console.log('📊 getUsers: Making API request to /api/users...');
      const users = await this.makeApiRequest<User[]>('/users');
      
      // Validate response is an array
      if (!Array.isArray(users)) {
        console.error('❌ getUsers: Invalid response format - expected array, got:', typeof users, users);
        throw new Error('Invalid response format: expected array');
      }
      
      console.log(`✅ getUsers: Successfully fetched ${users.length} users from API`);
      
      if (users.length === 0) {
        console.warn('⚠️ getUsers: API returned 0 users. This might indicate:');
        console.warn('   1. No users exist in the database');
        console.warn('   2. Authentication/authorization issue');
        console.warn('   3. Database connection problem');
      }
      
      // Cache the API data locally for offline use (use production cache key)
      this.setLocalStorageData('reRideUsers_prod', users);
      return users;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Production API failed to load users:', errorMessage);
      
      // Check if it's an authentication/authorization error
      if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Admin access required')) {
        console.error('❌ Access denied: Admin role required to fetch users. Please ensure you are logged in as an admin.');
        // Still try to use cached data if available
        const cachedUsers = this.getLocalStorageData<User[]>('reRideUsers_prod', []);
        if (cachedUsers.length > 0) {
          console.warn('⚠️ Using cached users data due to access denied');
          return cachedUsers;
        }
        return [];
      }
      
      if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
        console.error('❌ Authentication failed: Please log in again.');
        // Clear potentially stale tokens
        try {
          localStorage.removeItem('reRideAccessToken');
          sessionStorage.removeItem('accessToken');
        } catch (e) {
          // Ignore storage errors
        }
      }
      
      // In production, try to use cached API data (not mock data)
      const cachedUsers = this.getLocalStorageData<User[]>('reRideUsers_prod', []);
      if (cachedUsers.length > 0) {
        console.warn('⚠️ Using cached production data due to API failure');
        return cachedUsers;
      }
      // If no cached data, return empty array (don't use mock data in production)
      console.error('❌ No cached production data available, returning empty array');
      return [];
    }
  }

  private async getUsersLocal(): Promise<User[]> {
    const fallbackUsers: User[] = [{
      name: 'Demo User',
      email: 'demo@reride.com',
      mobile: '9876543210',
      role: 'customer',
      location: 'Mumbai',
      status: 'active',
      createdAt: new Date().toISOString(),
    }];

    let users = this.getLocalStorageData<User[]>('reRideUsers', []);
    
    if (users.length === 0) {
      try {
        // Try to load mock data first
        const mockUsers = await import('../mock-users.json');
        if (mockUsers.default && mockUsers.default.length > 0) {
          users = mockUsers.default as User[];
          this.setLocalStorageData('reRideUsers', users);
          console.log('✅ Loaded mock users data:', users.length, 'users');
        } else {
          // Fallback to constants if mock data not available
          const { FALLBACK_USERS } = await import('../constants/fallback.js');
          users = FALLBACK_USERS;
          this.setLocalStorageData('reRideUsers', users);
        }
      } catch (error) {
        console.log('⚠️ Could not load mock users, using fallback:', error);
        users = fallbackUsers;
        this.setLocalStorageData('reRideUsers', users);
      }
    }

    return users;
  }

  async login(credentials: { email: string; password: string; role?: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    if (this.isDevelopment) {
      return this.loginLocal(credentials);
    }

    try {
      const result = await this.makeApiRequest<{ success: boolean, user?: User, reason?: string }>('/users', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', ...credentials }),
      });
      
      if (result.success && result.user) {
        // Store user session
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
      }
      
      return result;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.loginLocal(credentials);
    }
  }

  private async loginLocal(credentials: { email: string; password: string; role?: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    const users = await this.getUsersLocal();
    const user = users.find(u => u.email === credentials.email && u.password === credentials.password);
    
    if (!user) {
      return { success: false, reason: 'Invalid credentials.' };
    }
    
    if (credentials.role && user.role !== credentials.role) {
      return { success: false, reason: `User is not a registered ${credentials.role}.` };
    }
    
    if (user.status === 'inactive') {
      return { success: false, reason: 'Your account has been deactivated.' };
    }
    
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem('reRideCurrentUser', JSON.stringify(userWithoutPassword));
    return { success: true, user: userWithoutPassword };
  }

  async register(credentials: { name: string; email: string; password: string; mobile: string; role: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    if (this.isDevelopment) {
      return this.registerLocal(credentials);
    }

    try {
      const result = await this.makeApiRequest<{ success: boolean, user?: User, reason?: string }>('/users', {
        method: 'POST',
        body: JSON.stringify({ action: 'register', ...credentials }),
      });
      
      if (result.success && result.user) {
        // Update local cache (use production cache key in production)
        if (this.isDevelopment) {
          const users = await this.getUsersLocal();
          users.push(result.user as User);
          this.setLocalStorageData('reRideUsers', users);
        } else {
          const cachedUsers = this.getLocalStorageData<User[]>('reRideUsers_prod', []);
          cachedUsers.push(result.user as User);
          this.setLocalStorageData('reRideUsers_prod', cachedUsers);
        }
        
        // Store user session
        localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user));
      }
      
      return result;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      return this.registerLocal(credentials);
    }
  }

  private async registerLocal(credentials: { name: string; email: string; password: string; mobile: string; role: string; location?: string }): Promise<{ success: boolean, user?: User, reason?: string }> {
    const users = await this.getUsersLocal();
    
    if (users.find(u => u.email === credentials.email)) {
      return { success: false, reason: 'An account with this email already exists.' };
    }
    
    const newUser: User = {
      ...credentials,
      role: credentials.role as 'seller' | 'customer' | 'admin',
      location: credentials.location || 'Mumbai', // Default location if not provided
      status: 'active',
      createdAt: new Date().toISOString(),
      avatarUrl: `https://i.pravatar.cc/150?u=${credentials.email}`,
      subscriptionPlan: credentials.role === 'seller' ? 'free' : undefined,
      featuredCredits: credentials.role === 'seller' ? 0 : undefined,
      usedCertifications: credentials.role === 'seller' ? 0 : undefined,
    };
    
    users.push(newUser);
    this.setLocalStorageData('reRideUsers', users);
    
    const { password: _, ...userWithoutPassword } = newUser;
    localStorage.setItem('reRideCurrentUser', JSON.stringify(userWithoutPassword));
    return { success: true, user: userWithoutPassword };
  }

  // Vehicle data operations
  async getVehicleData(): Promise<VehicleData> {
    if (this.isDevelopment) {
      return this.getVehicleDataLocal();
    }

    try {
      // Try the correct API endpoint for vehicle data
      const vehicleData = await this.makeApiRequest<VehicleData>('/vehicle-data');
      // Validate response structure
      if (!vehicleData || typeof vehicleData !== 'object') {
        throw new Error('Invalid response format: expected object');
      }
      this.setLocalStorageData('reRideVehicleData', vehicleData);
      return vehicleData;
    } catch (error) {
      console.warn('API failed, falling back to local storage:', error);
      // Always return local data as fallback
      return this.getVehicleDataLocal();
    }
  }

  private async getVehicleDataLocal(): Promise<VehicleData> {
    const fallbackData: VehicleData = {
      FOUR_WHEELER: [],
      TWO_WHEELER: [],
      THREE_WHEELER: []
    };

    let vehicleData = this.getLocalStorageData<VehicleData>('reRideVehicleData', fallbackData);
    
    if (Object.keys(vehicleData).length === 0) {
      try {
        const { VEHICLE_DATA } = await import('../components/vehicleData.js');
        vehicleData = VEHICLE_DATA;
        this.setLocalStorageData('reRideVehicleData', vehicleData);
      } catch {
        vehicleData = fallbackData;
        this.setLocalStorageData('reRideVehicleData', vehicleData);
      }
    }

    return vehicleData;
  }

  async saveVehicleData(data: VehicleData): Promise<boolean> {
    if (this.isDevelopment) {
      this.setLocalStorageData('reRideVehicleData', data);
      return true;
    }

    try {
      await this.makeApiRequest('/vehicle-data', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      this.setLocalStorageData('reRideVehicleData', data);
      return true;
    } catch (error) {
      console.warn('API failed, saving to local storage only:', error);
      this.setLocalStorageData('reRideVehicleData', data);
      return false;
    }
  }

  // Utility methods
  getCurrentUser(): User | null {
    try {
      const userJson = localStorage.getItem('reRideCurrentUser') || sessionStorage.getItem('currentUser');
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem('reRideCurrentUser');
    sessionStorage.removeItem('currentUser');
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  // Sync local data with API when online
  async syncWhenOnline(): Promise<void> {
    if (!this.isOnline() || this.isDevelopment) {
      return;
    }

    try {
      // Sync vehicles (use production cache key)
      const cacheKey = this.isDevelopment ? 'reRideVehicles' : 'reRideVehicles_prod';
      const localVehicles = this.getLocalStorageData<Vehicle[]>(cacheKey, []);
      if (localVehicles.length > 0) {
        const apiVehicles = await this.makeApiRequest<Vehicle[]>('/vehicles');
        // Merge local changes with API data
        const mergedVehicles = this.mergeVehicleData(localVehicles, apiVehicles);
        this.setLocalStorageData(cacheKey, mergedVehicles);
      }

      // Sync users (use production cache key)
      const usersCacheKey = this.isDevelopment ? 'reRideUsers' : 'reRideUsers_prod';
      const localUsers = this.getLocalStorageData<User[]>(usersCacheKey, []);
      if (localUsers.length > 0) {
        const apiUsers = await this.makeApiRequest<User[]>('/users');
        const mergedUsers = this.mergeUserData(localUsers, apiUsers);
        this.setLocalStorageData(usersCacheKey, mergedUsers);
      }
    } catch (error) {
      console.warn('Failed to sync data:', error);
    }
  }

  private mergeVehicleData(local: Vehicle[], api: Vehicle[]): Vehicle[] {
    const apiMap = new Map(api.map(v => [v.id, v]));
    const merged = [...api];
    
    // Add local vehicles that don't exist in API
    for (const localVehicle of local) {
      if (!apiMap.has(localVehicle.id)) {
        merged.push(localVehicle);
      }
    }
    
    return merged;
  }

  private mergeUserData(local: User[], api: User[]): User[] {
    const apiMap = new Map(api.map(u => [u.email, u]));
    const merged = [...api];
    
    // Add local users that don't exist in API
    for (const localUser of local) {
      if (!apiMap.has(localUser.email)) {
        merged.push(localUser);
      }
    }
    
    return merged;
  }
}

// Export singleton instance
export const dataService = new DataService();

// Export individual methods for backward compatibility
export const getVehicles = () => dataService.getVehicles();
export const addVehicle = (vehicleData: Vehicle) => dataService.addVehicle(vehicleData);
export const updateVehicle = (vehicleData: Vehicle) => dataService.updateVehicle(vehicleData);
export const deleteVehicle = (vehicleId: number) => dataService.deleteVehicle(vehicleId);
export const getUsers = () => dataService.getUsers();
export const login = (credentials: { email: string; password: string; role?: string }) => dataService.login(credentials);
export const register = (credentials: { name: string; email: string; password: string; mobile: string; role: string }) => dataService.register(credentials);
export const getVehicleData = () => dataService.getVehicleData();
export const saveVehicleData = (data: VehicleData) => dataService.saveVehicleData(data);
export const getCurrentUser = () => dataService.getCurrentUser();
export const logout = () => dataService.logout();
export const syncWhenOnline = () => dataService.syncWhenOnline();
