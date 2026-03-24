import type { Vehicle, User, VehicleData } from '../types';
import { queueRequest } from '../utils/requestQueue';
import { isCapacitorNative, resolveApiUrl } from '../utils/apiConfig';
import { ensureCsrfToken } from '../utils/authenticatedFetch';
import { getBrowserAccessTokenForApi } from '../utils/authStorage';

// Unified data service that handles both local and API data consistently
class DataService {
  /**
   * Vite dev / localhost / file: — used only as input to `isDevelopment` getter.
   * Capacitor WebView uses https://localhost but must still use the production API + Supabase.
   */
  private devHostFlag: boolean;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.devHostFlag = this.detectDevelopment();
  }

  /**
   * Never treat the native app as "development" for data: localhost there is the WebView, not a dev server.
   * Otherwise getVehicles() returns getVehiclesLocal() and ignores Supabase (website would show 7, app 0).
   */
  private get isDevelopment(): boolean {
    if (typeof window !== 'undefined' && isCapacitorNative()) {
      return false;
    }
    return this.devHostFlag;
  }

  /** Full `/api/...` URL: same rules as `resolveApiUrl` (WebView → `https://www.reride.co.in/...`). */
  private resolveDataApiUrl(endpoint: string): string {
    const path = endpoint.startsWith('/') ? `/api${endpoint}` : `/api/${endpoint}`;
    return resolveApiUrl(path);
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

    // On Capacitor native, bypass the sequential queue for GET requests so the initial
    // vehicles + users fetches run in parallel instead of serialized behind a 200ms delay.
    // The queue was designed for rate-limit protection; mobile startup should not be throttled.
    const bypassQueue = isCapacitorNative() && method === 'GET';

    const doRequest = async () => {
        let csrfHeader: string | undefined;
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          const t = await ensureCsrfToken();
          if (t) csrfHeader = t;
        }

        const headersRecord: Record<string, string> = {
          Accept: 'application/json',
          ...(shouldSendJson ? { 'Content-Type': 'application/json' } : {}),
          ...(csrfHeader ? { 'X-CSRF-Token': csrfHeader } : {}),
          ...(isCapacitorNative() ? { 'X-App-Client': 'capacitor' } : {}),
          ...this.getAuthHeaders(),
          ...((options.headers || {}) as Record<string, string>)
        };

        // Capacitor WebView origin is https://localhost — credentialed cross-origin + third-party cookies
        // often fail; API uses JWT headers and server skips CSRF for X-App-Client: capacitor.
        const credentialsMode: RequestCredentials = isCapacitorNative() ? 'omit' : 'include';

        const fetchOptions: RequestInit = {
          ...options,
          method,
          headers: headersRecord,
          credentials: credentialsMode
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
          const primaryUrl = this.resolveDataApiUrl(endpoint);
          const fallbackUrl: string | null = null;
          const fetchTimeoutMs = isCapacitorNative() ? 20000 : 7000;
          try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);

            // Reduce noise: only emit detailed URL diagnostics for vehicles listing.
            const shouldDebugVehicles = endpoint.includes('/vehicles');
            if (shouldDebugVehicles) {
              // eslint-disable-next-line no-console
              console.info('VEHICLES_API_URLS', { primaryUrl, fallbackUrl });
            }

            const resp = await fetch(primaryUrl, {
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
            // Best-effort fallback for cases where only one hostname works (common on some networks/DNS).
            // If the fallback also fails, we throw the same user-facing network error.
            if (fetchError instanceof Error) {
              // This will show up in logcat and helps diagnose the exact failure.
              // eslint-disable-next-line no-console
              const shouldDebugVehicles = endpoint.includes('/vehicles');
              if (shouldDebugVehicles) {
                console.warn('API fetch failed (network). Retrying with fallback if available:', {
                  message: fetchError.message,
                  name: fetchError.name,
                  primaryUrl,
                  fallbackUrl,
                });
              }
            }

            const fallbackFetchUrl = fallbackUrl;

            if (fallbackFetchUrl) {
              try {
                const shouldDebugVehicles = endpoint.includes('/vehicles');
                if (shouldDebugVehicles) {
                  // eslint-disable-next-line no-console
                  console.warn('VEHICLES_API_TRY_FALLBACK_URL', fallbackFetchUrl);
                }
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), fetchTimeoutMs);
                const resp2 = await fetch(fallbackFetchUrl, {
                  ...fetchOptions,
                  signal: controller2.signal,
                });
                clearTimeout(timeoutId2);
                if (endpoint.includes('/vehicles')) {
                  // eslint-disable-next-line no-console
                  console.warn('VEHICLES_API_FALLBACK_RESPONDED', resp2.status);
                }
                return resp2;
              } catch {
                // Swallow and throw the primary network error below.
                if (endpoint.includes('/vehicles')) {
                  // eslint-disable-next-line no-console
                  console.warn('VEHICLES_API_FALLBACK_FAILED_NETWORK');
                }
              }
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
              headersRecord['Authorization'] = `Bearer ${refreshResult.accessToken}`;
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
          
          // Handle 503 Service Unavailable errors specially (e.g., missing SUPABASE_SERVICE_ROLE_KEY)
          if (response.status === 503) {
            const errorText = await response.text();
            let errorMessage = 'Service temporarily unavailable. Please try again later.';
            let errorData: any = {};
            
            try {
              errorData = JSON.parse(errorText);
              // Prioritize reason field, then error field, then diagnostic
              errorMessage = errorData.reason || errorData.error || errorData.diagnostic || errorMessage;
            } catch {
              // Use default error message if JSON parsing fails
            }
            
            // Throw error with status code and preserve error data
            const error: any = new Error(errorMessage);
            error.status = 503;
            error.code = 503;
            error.errorData = errorData; // Preserve full error object for detailed logging
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
    };

    if (bypassQueue) {
      return doRequest();
    }

    return queueRequest(
      doRequest,
      {
        priority: requestPriority,
        id: `${method}_${endpoint}`,
        maxRetries: method === 'GET' ? 2 : 1
      }
    );
  }

  private getAuthHeaders(): Record<string, string> {
    try {
      const accessToken =
        getBrowserAccessTokenForApi() ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('accessToken') : null);
      if (accessToken) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 getAuthHeaders: Access token found, length:', accessToken.length);
        }
        return { Authorization: `Bearer ${accessToken}` };
      }
      // Many routes (e.g. published vehicles) are public — missing token is normal for anonymous users.
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

  /** Normalize GET /vehicles response (array or paginated envelope). */
  private extractVehiclesFromApiResponse(
    response: Vehicle[] | { vehicles?: Vehicle[]; pagination?: { page?: number; limit?: number; total?: number; pages?: number; hasMore?: boolean } }
  ): {
    vehicles: Vehicle[];
    pagination?: { page?: number; limit?: number; total?: number; pages?: number; hasMore?: boolean };
  } {
    if (Array.isArray(response)) {
      return { vehicles: response };
    }
    if (response && typeof response === 'object' && 'vehicles' in response) {
      return {
        vehicles: response.vehicles || [],
        pagination: response.pagination,
      };
    }
    throw new Error('Invalid response format: expected array or object with vehicles property');
  }

  /**
   * If the API returns a paginated envelope with hasMore, fetch remaining pages so the app matches the website inventory.
   * (Public published listing only — admin-all returns a full array in one response.)
   */
  private async expandPublishedVehiclesIfPaginated(
    firstResponse: Vehicle[] | { vehicles?: Vehicle[]; pagination?: { page?: number; limit?: number; total?: number; pages?: number; hasMore?: boolean } },
    includeAllStatuses: boolean,
    isNativeWebView: boolean
  ): Promise<Vehicle[]> {
    const { vehicles, pagination } = this.extractVehiclesFromApiResponse(firstResponse);
    if (includeAllStatuses || !pagination) {
      return vehicles;
    }

    const p = pagination;
    const total = typeof p.total === 'number' && !Number.isNaN(p.total) ? p.total : undefined;
    const pages = typeof p.pages === 'number' && !Number.isNaN(p.pages) ? p.pages : undefined;
    const pageNum = Number(p.page) || 1;

    // Do not trust hasMore alone — align with total/pages so we never request page 2 when the server reports a single page (avoids noisy logs and wasted requests).
    if (pages !== undefined && pageNum >= pages) {
      return vehicles;
    }
    if (total !== undefined && vehicles.length >= total) {
      return vehicles;
    }
    if (!p.hasMore) {
      return vehicles;
    }

    const limit = Math.max(1, Number(p.limit) || 50);
    let page = pageNum + 1;
    let hasMore = !!p.hasMore;
    const merged = [...vehicles];
    const maxPages = 100;

    while (hasMore && page <= maxPages) {
      const endpoint = isNativeWebView
        ? `/vehicles?limit=${limit}&page=${page}&skipExpiryCheck=true`
        : `/vehicles?limit=${limit}&page=${page}&skipExpiryCheck=true`;
      const nextRaw = await this.makeApiRequest<Vehicle[] | { vehicles: Vehicle[]; pagination?: typeof pagination }>(endpoint);
      const next = this.extractVehiclesFromApiResponse(nextRaw);
      merged.push(...next.vehicles);
      if (next.vehicles.length === 0) {
        break;
      }
      const np = next.pagination;
      if (typeof np?.total === 'number' && merged.length >= np.total) {
        break;
      }
      if (typeof np?.pages === 'number' && page >= np.pages) {
        break;
      }
      hasMore = !!np?.hasMore;
      page++;
    }

    if (hasMore && page > maxPages) {
      console.warn(`⚠️ Vehicle pagination stopped at ${maxPages} pages (safety cap). Loaded ${merged.length} vehicles.`);
    } else if (merged.length > vehicles.length) {
      console.log(`✅ Expanded paginated vehicle listing: ${merged.length} total (was ${vehicles.length} on first page)`);
    }
    return merged;
  }

  // Vehicle operations
  async getVehicles(includeAllStatuses: boolean = false, forceRefresh: boolean = false): Promise<Vehicle[]> {
    // In development, use API when Supabase is configured so real vehicle images from Storage load
    const useApiInDev =
      this.isDevelopment &&
      typeof import.meta !== 'undefined' &&
      (import.meta as any).env?.VITE_SUPABASE_URL;

    if (this.isDevelopment && !useApiInDev) {
      return this.getVehiclesLocal();
    }

    // Loading the full dataset (limit=0) can produce very large JSON payloads.
    // On Android WebView this may block the JS thread long enough to trigger an ANR.
    const isNativeWebView = isCapacitorNative();
    // Mobile: use paginated first page (smaller payload, faster) then expand via expandPublishedVehiclesIfPaginated.
    // limit=0 skips pagination on the server; pairing limit=0 with page=1 is confusing in logs and unnecessary here.
    const nativeVehiclesPageLimit = 30;
    const maxNativeVehiclesCacheChars = 2_000_000; // ~2MB; generous limit so full dataset fits in cache

    // STEP 1: Check cache first for instant response (unless forceRefresh or dev with Supabase)
    const cacheKey = 'reRideVehicles_prod';
    if (isNativeWebView) {
      // If a previous version cached a very large vehicle list, avoid parsing it on startup.
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw && raw.length > maxNativeVehiclesCacheChars) {
          localStorage.removeItem(cacheKey);
          console.warn(`⚠️ Cleared oversized native vehicle cache (${raw.length} chars)`);
        }
      } catch {
        // Ignore localStorage errors; we'll just fall back to empty cache.
      }
    }
    const cachedVehicles = this.getLocalStorageData<Vehicle[]>(cacheKey, []);
    
      // In dev with Supabase, skip cache so we always get fresh vehicles with correct image URLs
      // CRITICAL FIX: For admin operations, bypass cache and fetch fresh data
      // On native mobile, do not return cache immediately because old cache can diverge from website listings.
      // We still keep cache as fallback if API fails.
      if (cachedVehicles.length > 0 && !forceRefresh && !useApiInDev && !isNativeWebView) {
        // Fetch fresh data in background (don't await) - use pagination for speed
        // On Android WebView we intentionally keep this small to avoid ANR from huge JSON payloads.
        const endpoint = includeAllStatuses
          ? '/vehicles?action=admin-all'
          : isNativeWebView
            ? `/vehicles?limit=${nativeVehiclesPageLimit}&page=1&skipExpiryCheck=true`
            : '/vehicles?limit=0&skipExpiryCheck=true';
        this.makeApiRequest<Vehicle[] | { vehicles: Vehicle[]; pagination?: any }>(endpoint)
          .then(async (response) => {
            try {
              const vehicles = await this.expandPublishedVehiclesIfPaginated(
                response,
                includeAllStatuses,
                isNativeWebView
              );
              if (Array.isArray(vehicles) && vehicles.length >= 0) {
                this.setLocalStorageData(cacheKey, vehicles);
                console.log(`✅ Background refresh: Updated cache with ${vehicles.length} vehicles`);
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                  window.dispatchEvent(new CustomEvent('vehiclesCacheUpdated', { detail: { vehicles } }));
                }
              } else if (vehicles.length === 0) {
                console.warn('⚠️ Background refresh returned 0 vehicles. Keeping cached data.');
              }
            } catch (parseErr) {
              console.warn('⚠️ Invalid background refresh response format:', parseErr);
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
    // Use limit=0 to get all vehicles (backward compatible) on web;
    // on Android WebView we use a small page to avoid ANR from large payloads.
    try {
      // Use limit=0 to get all vehicles as array (not paginated object)
      const endpoint = includeAllStatuses
        ? '/vehicles?action=admin-all'
        : isNativeWebView
          ? `/vehicles?limit=${nativeVehiclesPageLimit}&page=1&skipExpiryCheck=true`
          : '/vehicles?limit=0&skipExpiryCheck=true';
      const response = await this.makeApiRequest<Vehicle[] | { vehicles: Vehicle[]; pagination?: any }>(endpoint);

      const vehicles = await this.expandPublishedVehiclesIfPaginated(
        response,
        includeAllStatuses,
        isNativeWebView
      );

      if (!Array.isArray(vehicles)) {
        console.error('❌ Invalid response format: expected array, got:', typeof vehicles);
        throw new Error('Invalid response format: expected array');
      }

      console.log(
        `✅ Loaded ${vehicles.length} vehicles from production API (response type: ${Array.isArray(response) ? 'array' : 'paginated'}${forceRefresh ? ', forced refresh' : ''})`
      );
      
      if (vehicles.length === 0) {
        console.warn('⚠️ API returned 0 vehicles. This might indicate:');
        console.warn('   1. No vehicles exist in the database');
        console.warn('   2. All vehicles are filtered out (check status filters)');
        console.warn('   3. Database connection issue');
        console.warn('   4. Authentication/authorization issue');
        if (includeAllStatuses) {
          console.warn('   5. Admin query might be failing - check SUPABASE_SERVICE_ROLE_KEY');
        }
      } else {
        // Log breakdown by status for admin queries
        if (includeAllStatuses) {
          const statusCounts = vehicles.reduce((acc, v) => {
            acc[v.status] = (acc[v.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log(`📊 Vehicle status breakdown:`, statusCounts);
        }
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
      
      // If no cached data, log detailed error
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
      
      // Rethrow 503 so caller (e.g. refreshVehicles) can show a specific "check Supabase env" message
      const status = (error as any)?.status ?? (error as any)?.code;
      if (status === 503) {
        throw error;
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
        // Try to load mock data from constants
        const { MOCK_VEHICLES } = await import('../constants');
        vehicles = await MOCK_VEHICLES();
        this.setLocalStorageData('reRideVehicles', vehicles);
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
  async getUsers(forceRefresh: boolean = false): Promise<User[]> {
    if (this.isDevelopment) {
      return this.getUsersLocal();
    }

    // CRITICAL FIX: For admin operations, bypass cache and fetch fresh data
    const cacheKey = 'reRideUsers_prod';
    const cachedUsers = this.getLocalStorageData<User[]>(cacheKey, []);
    
    // If we have cached data and NOT forcing refresh, return it immediately and fetch fresh data in background
    if (cachedUsers.length > 0 && !forceRefresh) {
      // Fetch fresh data in background (don't await)
      this.makeApiRequest<User[] | { users?: User[]; data?: User[]; success?: boolean; reason?: string; diagnostic?: string }>('/users')
        .then(rawResponse => {
          // Handle response
          if (rawResponse && typeof rawResponse === 'object' && 'success' in rawResponse && rawResponse.success === false) {
            console.warn('⚠️ Background user refresh returned error:', rawResponse.reason);
            return;
          }
          
          const users = Array.isArray(rawResponse)
            ? rawResponse
            : Array.isArray(rawResponse?.users)
              ? rawResponse.users
              : Array.isArray(rawResponse?.data)
                ? rawResponse.data
                : [];
          
          if (Array.isArray(users) && users.length >= 0) {
            this.setLocalStorageData(cacheKey, users);
            console.log(`✅ Background refresh: Updated cache with ${users.length} users`);
            // Notify UI so user data stays in sync (e.g. after Supabase/API updates)
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('usersCacheUpdated', { detail: { users } }));
            }
          }
        })
        .catch(error => {
          console.warn('Background user refresh failed (using cache):', error);
        });
      
      // Return cached data immediately
      console.log(`✅ Returning ${cachedUsers.length} cached users instantly`);
      return cachedUsers;
    }

    try {
      // Check if we have an access token before making the request
      let accessToken = localStorage.getItem('reRideAccessToken') || sessionStorage.getItem('accessToken');
      if (!accessToken) {
        // Try refresh-token flow before giving up.
        // This is critical in production where currentUser may be restored from storage
        // but access token is temporarily missing.
        try {
          const { refreshAccessToken } = await import('./userService');
          const refreshResult = await refreshAccessToken();
          if (refreshResult.success && refreshResult.accessToken) {
            accessToken = refreshResult.accessToken;
            if (typeof window !== 'undefined') {
              localStorage.setItem('reRideAccessToken', accessToken);
            }
            console.log('✅ getUsers: Refreshed missing access token successfully');
          }
        } catch (refreshError) {
          console.warn('⚠️ getUsers: Token refresh failed when token was missing:', refreshError);
        }

        if (!accessToken) {
          console.warn('⚠️ No access token found. Will attempt unauthenticated API call (public endpoints like sellers still work).');
        }
      }

      console.log('📊 getUsers: Making API request to /api/users...');
      const rawResponse = await this.makeApiRequest<User[] | { users?: User[]; data?: User[]; success?: boolean; reason?: string; diagnostic?: string }>('/users');
      
      // Check if response indicates an error (503 or other error format)
      if (rawResponse && typeof rawResponse === 'object' && 'success' in rawResponse && rawResponse.success === false) {
        const errorReason = rawResponse.reason || 'Unknown error';
        const errorDiagnostic = rawResponse.diagnostic || '';
        
        // Store error message in localStorage for UI to display
        const errorInfo = {
          reason: errorReason,
          diagnostic: errorDiagnostic,
          timestamp: Date.now()
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('reRideUsers_error', JSON.stringify(errorInfo));
        }
        
        // Check if it's a 503/configuration error
        if (errorReason.includes('SUPABASE_SERVICE_ROLE_KEY') || errorReason.includes('Service temporarily unavailable') || errorDiagnostic.includes('Service role key')) {
          console.error('❌ CRITICAL: Service unavailable error when fetching users:', errorReason);
          if (errorDiagnostic) {
            console.error('   Diagnostic:', errorDiagnostic);
          }
          console.error('   This usually means SUPABASE_SERVICE_ROLE_KEY is missing or misconfigured.');
          console.error('   Check Vercel environment variables and ensure the key is set for Production environment.');
          
          // Throw error with specific message so UI can display it
          const configError: any = new Error(errorReason);
          configError.status = 503;
          configError.code = 503;
          configError.errorData = { reason: errorReason, diagnostic: errorDiagnostic };
          throw configError;
        }
        
        // For other errors, throw with the reason
        throw new Error(errorReason);
      }
      
      const users = Array.isArray(rawResponse)
        ? rawResponse
        : Array.isArray(rawResponse?.users)
          ? rawResponse.users
          : Array.isArray(rawResponse?.data)
            ? rawResponse.data
            : [];
      
      // Validate response is an array
      if (!Array.isArray(users)) {
        console.error('❌ getUsers: Invalid response format - expected array, got:', typeof rawResponse, rawResponse);
        throw new Error('Invalid response format: expected array');
      }
      
      // Clear any previous error messages on success
      if (typeof window !== 'undefined') {
        localStorage.removeItem('reRideUsers_error');
      }
      
      console.log(`✅ getUsers: Successfully fetched ${users.length} users from API${forceRefresh ? ' (forced refresh)' : ''}`);
      
      if (users.length === 0) {
        console.warn('⚠️ getUsers: API returned 0 users. This might indicate:');
        console.warn('   1. No users exist in the database');
        console.warn('   2. Authentication/authorization issue');
        console.warn('   3. Database connection problem');
        console.warn('   4. SUPABASE_SERVICE_ROLE_KEY might be missing (check Vercel environment variables)');
      }
      
      // Cache the API data locally for offline use (use production cache key)
      this.setLocalStorageData('reRideUsers_prod', users);
      return users;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorAny = error as any;
      
      // Check for 503 Service Unavailable errors (e.g., missing SUPABASE_SERVICE_ROLE_KEY)
      if (errorAny?.status === 503 || errorAny?.code === 503 || errorMessage.includes('503') || errorMessage.includes('Service temporarily unavailable')) {
        const detailedError = errorAny?.errorData || {};
        const reason = detailedError.reason || errorMessage;
        const diagnostic = detailedError.diagnostic || '';
        
        console.error('❌ CRITICAL: Service unavailable error when fetching users:', reason);
        if (diagnostic) {
          console.error('   Diagnostic:', diagnostic);
        }
        console.error('   This usually means SUPABASE_SERVICE_ROLE_KEY is missing or misconfigured.');
        console.error('   Check Vercel environment variables and ensure the key is set for Production environment.');
        
        // Store error so AdminPanel can show the configuration banner (getUsers returns [] so fetchUsers doesn't catch)
        const errorInfo = { reason, diagnostic, timestamp: Date.now() };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('reRideUsers_error', JSON.stringify(errorInfo));
          } catch (e) {
            // Ignore storage errors
          }
        }
        
        // Don't use cached data for 503 errors - they indicate a configuration problem
        // Return empty array so the UI shows 0 users, which will prompt admin to check configuration
        return [];
      }
      
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
        try { localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user)); } catch { /* storage unavailable */ }
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
    try { localStorage.setItem('reRideCurrentUser', JSON.stringify(userWithoutPassword)); } catch { /* storage unavailable */ }
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
        
        try { localStorage.setItem('reRideCurrentUser', JSON.stringify(result.user)); } catch { /* storage unavailable */ }
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
    try {
      localStorage.removeItem('reRideCurrentUser');
      sessionStorage.removeItem('currentUser');
    } catch { /* storage unavailable */ }
  }

  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
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
