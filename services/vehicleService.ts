
import type { Vehicle, User, VehicleCategory } from '../types';
import { isVehicle, isApiResponse } from '../types';
import { isDevelopmentEnvironment } from '../utils/environment';

// Fallback mock vehicles to prevent loading issues
const FALLBACK_VEHICLES: Vehicle[] = [
  {
    id: 1,
    category: "FOUR_WHEELER" as VehicleCategory,
    make: "Maruti Suzuki",
    model: "Swift",
    year: 2022,
    price: 650000,
    mileage: 18000,
    fuelType: "Petrol",
    transmission: "Manual",
    location: "Mumbai",
    city: "Mumbai",
    state: "MH",
    sellerEmail: "demo@reride.com",
    images: ["https://picsum.photos/800/600?random=1"],
    features: ["Air Conditioning", "Power Steering", "Music System"],
    description: "Well maintained Swift in excellent condition",
    engine: "1.2L Petrol",
    fuelEfficiency: "20 kmpl",
    color: "White",
    status: "published",
    isFeatured: true,
    views: 150,
    inquiriesCount: 8,
    certificationStatus: "none",
    registrationYear: 2022,
    insuranceValidity: "2025-01-01",
    insuranceType: "Comprehensive",
    rto: "MH-01",
    noOfOwners: 1,
    displacement: "1197 cc",
    groundClearance: "170 mm",
    bootSpace: "268 litres"
  }
];

// --- API Helpers ---
const getAuthHeader = () => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return {};
    }
    
    // Try localStorage first for persistent login, fallback to sessionStorage
    const userJson = localStorage.getItem('reRideCurrentUser') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('currentUser') : null);
    if (!userJson) return {};
    const user: User = JSON.parse(userJson);
    
    // Check if user has access token
    const accessToken = localStorage.getItem('reRideAccessToken') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('accessToken') : null);
    if (accessToken) {
      return { 'Authorization': `Bearer ${accessToken}` };
    }
    
    // Fallback to email for backward compatibility (not recommended for production)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('No access token found, using email for authorization (not secure)');
    }
    return { 'Authorization': user.email };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to get auth header:', error);
    }
    return {};
  }
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    // For 500 errors, don't throw - let the fallback mechanism handle it
    if (response.status >= 500) {
      console.warn(`API returned ${response.status}: ${response.statusText}, will use fallback data`);
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    let errorPayload: any = null;
    try {
      errorPayload = await response.json();
    } catch {
      // Ignore JSON parse errors for non-JSON payloads
    }

    const errorMessage =
      errorPayload?.error ||
      errorPayload?.reason ||
      errorPayload?.message ||
      `Failed to fetch: ${response.statusText}`;
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

  // Type guard for API responses
  if (isApiResponse<T>(data)) {
    return data.data;
  }

  return data;
};

// --- Local Development (localStorage) Functions ---

export const getVehiclesLocal = async (): Promise<Vehicle[]> => {
    try {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return FALLBACK_VEHICLES;
        }
        
        if (process.env.NODE_ENV !== 'production') {
            console.log('getVehiclesLocal: Starting...');
        }
        let vehiclesJson = localStorage.getItem('reRideVehicles');
        if (!vehiclesJson) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('getVehiclesLocal: No cached data, loading MOCK_VEHICLES...');
            }
            // Dynamically import MOCK_VEHICLES to avoid blocking initial load
            const { MOCK_VEHICLES } = await import('../constants');
            localStorage.setItem('reRideVehicles', JSON.stringify(MOCK_VEHICLES));
            vehiclesJson = JSON.stringify(MOCK_VEHICLES);
        } else {
            if (process.env.NODE_ENV !== 'production') {
                console.log('getVehiclesLocal: Using cached data');
            }
        }
        const vehicles = JSON.parse(vehiclesJson);
        if (process.env.NODE_ENV !== 'production') {
            console.log('getVehiclesLocal: Successfully loaded', vehicles.length, 'vehicles');
        }
        return vehicles;
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('getVehiclesLocal: Error loading vehicles:', error);
            console.log('getVehiclesLocal: Returning FALLBACK_VEHICLES as fallback');
        }
        // Return FALLBACK_VEHICLES as final fallback
        return FALLBACK_VEHICLES;
    }
};

const addVehicleLocal = async (vehicleData: Vehicle): Promise<Vehicle> => {
    try {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return vehicleData;
        }
        
        const vehicles = await getVehiclesLocal();
        vehicles.unshift(vehicleData);
        localStorage.setItem('reRideVehicles', JSON.stringify(vehicles));
        return vehicleData;
    } catch (error) {
        // Handle quota exceeded error
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('⚠️ LocalStorage quota exceeded, clearing old data...');
                }
                // Clear old vehicles and try again
                localStorage.removeItem('reRideVehicles');
                const freshVehicles = [vehicleData];
                localStorage.setItem('reRideVehicles', JSON.stringify(freshVehicles));
            }
            return vehicleData;
        }
        throw error;
    }
};

const updateVehicleLocal = async (vehicleData: Vehicle): Promise<Vehicle> => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return vehicleData;
    }
    
    let vehicles = await getVehiclesLocal();
    vehicles = vehicles.map(v => v.id === vehicleData.id ? vehicleData : v);
    localStorage.setItem('reRideVehicles', JSON.stringify(vehicles));
    return vehicleData;
};

const deleteVehicleLocal = async (vehicleId: number): Promise<{ success: boolean, id: number }> => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return { success: true, id: vehicleId };
    }
    
    let vehicles = await getVehiclesLocal();
    vehicles = vehicles.filter(v => v.id !== vehicleId);
    localStorage.setItem('reRideVehicles', JSON.stringify(vehicles));
    return { success: true, id: vehicleId };
};


// --- Production (API) Functions ---

/**
 * Fetch vehicles with pagination support
 * @param page - Page number (1-indexed)
 * @param limit - Number of vehicles per page (default: 12 for optimal performance)
 * @returns Object with vehicles array and pagination metadata
 */
export const getVehiclesApiPaginated = async (
  page: number = 1,
  limit: number = 12
): Promise<{ vehicles: Vehicle[]; pagination: { page: number; limit: number; total: number; pages: number; hasMore: boolean } }> => {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const response = await authenticatedFetch(`/api/vehicles?page=${page}&limit=${limit}`, {
    method: 'GET',
  });
  const result = await handleApiResponse<{ vehicles: Vehicle[]; pagination?: any }>(response);
  
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to fetch vehicles');
  }
  
  if (result.data && typeof result.data === 'object' && 'vehicles' in result.data) {
    const vehicles = result.data.vehicles || [];
    const pagination = result.data.pagination || { page, limit, total: vehicles.length, pages: 1, hasMore: false };
    
    const validVehicles = vehicles.filter(isVehicle);
    if (validVehicles.length !== vehicles.length) {
      console.warn(`Filtered out ${vehicles.length - validVehicles.length} invalid vehicles`);
    }
    
    return {
      vehicles: validVehicles,
      pagination: {
        page: pagination.page || page,
        limit: pagination.limit || limit,
        total: pagination.total || validVehicles.length,
        pages: pagination.pages || 1,
        hasMore: pagination.hasMore || false
      }
    };
  }
  
  throw new Error('Invalid response format: expected object with vehicles property');
};

const getVehiclesApi = async (): Promise<Vehicle[]> => {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  // Use limit=0 to get all vehicles (backward compatible) or limit=50 for faster load
  const response = await authenticatedFetch('/api/vehicles?limit=0', {
    method: 'GET',
  });
  const result = await handleApiResponse<Vehicle[] | { vehicles: Vehicle[]; pagination?: any }>(response);
  
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to fetch vehicles');
  }
  
  // Handle both array response (limit=0) and paginated response (limit>0)
  let data: Vehicle[];
  if (Array.isArray(result.data)) {
    data = result.data;
  } else if (result.data && typeof result.data === 'object' && 'vehicles' in result.data) {
    data = result.data.vehicles || [];
  } else {
    throw new Error('Invalid response format: expected array or object with vehicles property');
  }
  
  // Validate that all items are vehicles
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format: expected array');
  }
  
  const validVehicles = data.filter(isVehicle);
  if (validVehicles.length !== data.length) {
    console.warn(`Filtered out ${data.length - validVehicles.length} invalid vehicles`);
  }
  
  return validVehicles;
};

const addVehicleApi = async (vehicleData: Vehicle): Promise<Vehicle> => {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const response = await authenticatedFetch('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicleData),
  });
  const result = await handleApiResponse<Vehicle>(response);
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to add vehicle');
  }
  return result.data!;
};

const updateVehicleApi = async (vehicleData: Vehicle): Promise<Vehicle> => {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const response = await authenticatedFetch('/api/vehicles', {
    method: 'PUT',
    body: JSON.stringify(vehicleData),
  });
  const result = await handleApiResponse<Vehicle>(response);
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to update vehicle');
  }
  return result.data!;
};

const deleteVehicleApi = async (vehicleId: number): Promise<{ success: boolean, id: number }> => {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const response = await authenticatedFetch('/api/vehicles', {
    method: 'DELETE',
    body: JSON.stringify({ id: vehicleId }),
  });
  const result = await handleApiResponse<{ success: boolean, id: number }>(response);
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to delete vehicle');
  }
  return result.data!;
};


// --- Environment Detection ---
// Use local storage in development, API in production
const isDevelopment = (): boolean => {
  try {
    return isDevelopmentEnvironment() || 
           window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('localhost') ||
           window.location.protocol === 'file:';
  } catch {
    return false;
  }
};

// --- Exported Environment-Aware Service Functions ---

export const getVehicles = async (): Promise<Vehicle[]> => {
  try {
    const isDev = isDevelopment();
    console.log('getVehicles: Starting, isDevelopment:', isDev);
    
    // Always try API first for production, with fallback to local
    if (!isDev) {
      try {
        console.log('getVehicles: Trying API...');
        const result = await getVehiclesApi();
        console.log(`✅ getVehicles: API success, loaded ${result.length} vehicles`);
        
        // Validate result is an array
        if (!Array.isArray(result)) {
          console.error('❌ getVehicles: API returned non-array:', typeof result);
          throw new Error('Invalid response format: expected array');
        }
        
        // Cache production data (not mock data)
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('reRideVehicles_prod', JSON.stringify(result));
            console.log('✅ Cached production vehicles to localStorage');
          } catch (cacheError) {
            console.warn('⚠️ Failed to cache vehicles:', cacheError);
          }
        }
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ getVehicles: Production API failed:', errorMessage);
        
        // In production, try to use cached API data (not mock data)
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          try {
            const cachedVehiclesJson = localStorage.getItem('reRideVehicles_prod');
            if (cachedVehiclesJson) {
              const cachedVehicles = JSON.parse(cachedVehiclesJson);
              if (Array.isArray(cachedVehicles) && cachedVehicles.length > 0) {
                console.warn(`⚠️ getVehicles: Using cached production data (${cachedVehicles.length} vehicles) due to API failure`);
                return cachedVehicles;
              }
            }
          } catch (cacheError) {
            console.error('❌ Failed to load cached production data:', cacheError);
          }
        }
        
        // If no cached data, return empty array (don't use mock data in production)
        console.error('❌ getVehicles: No cached production data available, returning empty array');
        console.error('💡 Troubleshooting:');
        console.error('   1. Check if /api/vehicles endpoint is working');
        console.error('   2. Verify Firebase database has vehicles');
        console.error('   3. Check browser network tab for API errors');
        console.error('   4. Try seeding the database: POST /api/seed');
        return [];
      }
    } else {
      // Development mode - use local storage
      console.log('getVehicles: Development mode, using local storage');
      return await getVehiclesLocal();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ getVehicles: Critical error:', errorMessage);
    
    // In production, return empty array instead of fallback vehicles
    if (!isDevelopment()) {
      console.error('💡 Production error - returning empty array. Check API and database configuration.');
      return [];
    }
    
    // Last resort fallback only in development
    console.warn('⚠️ Using fallback vehicles in development mode');
    return FALLBACK_VEHICLES;
  }
};
export const addVehicle = async (vehicleData: Vehicle): Promise<Vehicle> => {
  console.log('🔧 vehicleService.addVehicle called');
  console.log('📍 Environment - isDevelopment:', isDevelopment());
  console.log('📦 Vehicle data received:', vehicleData);
  
  // Always try API first for production, with fallback to local
  if (!isDevelopment()) {
    try {
      console.log('🌐 Attempting API call to /api/vehicles');
      const result = await addVehicleApi(vehicleData);
      console.log('✅ API call successful:', result);
      return result;
    } catch (error) {
      console.warn('⚠️ API addVehicle failed, falling back to local storage:', error);
      // Fallback to local storage if API fails
      return await addVehicleLocal(vehicleData);
    }
  } else {
    // Development mode - use local storage
    console.log('💻 Development mode - using local storage');
    const result = await addVehicleLocal(vehicleData);
    console.log('✅ Local storage save successful:', result);
    return result;
  }
};

export const updateVehicle = async (vehicleData: Vehicle): Promise<Vehicle> => {
  // Always try API first for production, with fallback to local
  if (!isDevelopment()) {
    try {
      return await updateVehicleApi(vehicleData);
    } catch (error) {
      console.warn('API updateVehicle failed, falling back to local storage:', error);
      // Fallback to local storage if API fails
      return await updateVehicleLocal(vehicleData);
    }
  } else {
    // Development mode - use local storage
    return await updateVehicleLocal(vehicleData);
  }
};

export const deleteVehicle = async (vehicleId: number): Promise<{ success: boolean, id: number }> => {
  // Always try API first for production, with fallback to local
  if (!isDevelopment()) {
    try {
      return await deleteVehicleApi(vehicleId);
    } catch (error) {
      console.warn('API deleteVehicle failed, falling back to local storage:', error);
      // Fallback to local storage if API fails
      return await deleteVehicleLocal(vehicleId);
    }
  } else {
    // Development mode - use local storage
    return await deleteVehicleLocal(vehicleId);
  }
};
