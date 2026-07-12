import { logInfo } from '../utils/logger.js';

import type { Vehicle, VehicleCategory } from '../types.js';
import { getBrowserAccessTokenForApi } from '../utils/authStorage.js';
import { isVehicle, isApiResponse } from '../types.js';
import { isDevelopmentEnvironment } from '../utils/environment.js';

import { FALLBACK_VEHICLES as SHARED_FALLBACK_VEHICLES } from '../constants/fallback.js';

// Re-export production-safe fallback (empty in prod builds)
const FALLBACK_VEHICLES: Vehicle[] = SHARED_FALLBACK_VEHICLES;

// --- API Helpers ---
const getAuthHeader = () => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return {};
    }
    const accessToken =
      getBrowserAccessTokenForApi() ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('accessToken') : null);
    if (accessToken) {
      return { Authorization: `Bearer ${accessToken}` };
    }
    return {};
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
            logInfo('getVehiclesLocal: Starting...');
        }
        let vehiclesJson = localStorage.getItem('reRideVehicles');
        if (!vehiclesJson) {
            if (process.env.NODE_ENV !== 'production') {
                logInfo('getVehiclesLocal: No cached data, loading MOCK_VEHICLES...');
            }
            // Dynamically import MOCK_VEHICLES to avoid blocking initial load
            const { MOCK_VEHICLES } = await import('../constants');
            localStorage.setItem('reRideVehicles', JSON.stringify(MOCK_VEHICLES));
            vehiclesJson = JSON.stringify(MOCK_VEHICLES);
        } else {
            if (process.env.NODE_ENV !== 'production') {
                logInfo('getVehiclesLocal: Using cached data');
            }
        }
        const vehicles = JSON.parse(vehiclesJson);
        if (process.env.NODE_ENV !== 'production') {
            logInfo('getVehiclesLocal: Successfully loaded', vehicles.length, 'vehicles');
        }
        return vehicles;
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('getVehiclesLocal: Error loading vehicles:', error);
            logInfo('getVehiclesLocal: Returning FALLBACK_VEHICLES as fallback');
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

const addVehicleApi = async (vehicleData: Vehicle, attempt = 0): Promise<Vehicle> => {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const { parseRetryAfterSeconds, retryDelayMs, sleepMs } = await import('../utils/rateLimitClient.js');
  const response = await authenticatedFetch('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicleData),
  });

  if (response.status === 429 && attempt < 2) {
    await sleepMs(retryDelayMs(parseRetryAfterSeconds(response), attempt));
    return addVehicleApi(vehicleData, attempt + 1);
  }

  const result = await handleApiResponse<Vehicle>(response);
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to add vehicle');
  }
  return result.data!;
};

const updateVehicleApi = async (vehicleData: Vehicle): Promise<Vehicle> => {
  const { getCanonicalPrimaryKey, VehicleMutationIdentityError } = await import('../utils/vehicleIdentity');
  const databaseId = getCanonicalPrimaryKey(vehicleData);
  if (!databaseId) {
    throw new VehicleMutationIdentityError();
  }
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const payload: Record<string, unknown> = {
    ...vehicleData,
    databaseId,
  };
  if (Number.isSafeInteger(vehicleData.id)) {
    payload.id = vehicleData.id;
  } else {
    payload.id = databaseId;
  }
  const response = await authenticatedFetch('/api/vehicles', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const result = await handleApiResponse<Vehicle>(response);
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to update vehicle');
  }
  return result.data!;
};

const deleteVehicleApi = async (
  vehicleId: number,
  databaseId?: string,
): Promise<{ success: boolean, id: number }> => {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const response = await authenticatedFetch('/api/vehicles', {
    method: 'DELETE',
    body: JSON.stringify({
      id: vehicleId,
      ...(databaseId && String(databaseId).trim() !== '' ? { databaseId: String(databaseId).trim() } : {}),
    }),
  });
  const result = await handleApiResponse<{ success: boolean, id: number }>(response);
  if (!result.success) {
    throw new Error(result.reason || result.error || 'Failed to delete vehicle');
  }
  return result.data!;
};


// --- Environment Detection ---
// Browser mutations go through the API (Vite proxies /api in dev) so auth and plan limits apply.
const preferApiForMutations = (): boolean => typeof window !== 'undefined';

// --- Exported Environment-Aware Service Functions ---

export const getVehicles = async (): Promise<Vehicle[]> => {
  try {
    // Single source of truth: DataService (local dev API vs production, Capacitor base URL, caching, pagination).
    const { dataService } = await import('./dataService');
    return await dataService.getVehicles(false, false);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ getVehicles: Critical error:', errorMessage);

    if (!isDevelopmentEnvironment()) {
      console.error('💡 Production error - returning empty array. Check API and database configuration.');
      return [];
    }

    console.warn('⚠️ Using fallback vehicles in development mode');
    return FALLBACK_VEHICLES;
  }
};
export const addVehicle = async (vehicleData: Vehicle): Promise<Vehicle> => {
  logInfo('🔧 vehicleService.addVehicle called');
  logInfo('📦 Vehicle data received:', vehicleData);

  if (preferApiForMutations()) {
    logInfo('🌐 Attempting API call to /api/vehicles');
    const result = await addVehicleApi(vehicleData);
    logInfo('✅ API call successful:', result);
    return result;
  }

  logInfo('💻 Non-browser runtime — using local storage');
  const result = await addVehicleLocal(vehicleData);
  logInfo('✅ Local storage save successful:', result);
  return result;
};

export const updateVehicle = async (vehicleData: Vehicle): Promise<Vehicle> => {
  if (preferApiForMutations()) {
    return await updateVehicleApi(vehicleData);
  }
  return await updateVehicleLocal(vehicleData);
};

export const deleteVehicle = async (
  vehicleId: number,
  databaseId?: string,
): Promise<{ success: boolean, id: number }> => {
  if (preferApiForMutations()) {
    return await deleteVehicleApi(vehicleId, databaseId);
  }
  return await deleteVehicleLocal(vehicleId);
};

type VehicleActionResponse = { success?: boolean; vehicle?: Vehicle; reason?: string; error?: string };

type VehicleActionOptions = {
  sellerEmail?: string;
  databaseId?: string;
};

async function postVehicleAction(
  action: 'sold' | 'unsold',
  vehicleId: number,
  vehicles: Vehicle[],
  options: VehicleActionOptions = {},
): Promise<Vehicle> {
  const { ensureVehicleMutationPayload } = await import('./vehicleIdentityService.js');
  const { authenticatedFetch } = await import('../utils/authenticatedFetch.js');
  const { findVehicleByIdentity } = await import('../utils/vehicleIdentity.js');
  const hintVehicle = findVehicleByIdentity(vehicles, vehicleId, options.databaseId);
  const payload = await ensureVehicleMutationPayload(vehicleId, vehicles, {
    sellerEmail: options.sellerEmail || hintVehicle?.sellerEmail,
    databaseId: options.databaseId || hintVehicle?.databaseId,
  });
  const response = await authenticatedFetch(`/api/vehicles?action=${action}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') || '';
  let result: VehicleActionResponse = {};
  if (contentType.includes('application/json')) {
    result = (await response.json()) as VehicleActionResponse;
  }

  if (!response.ok || !result.success || !result.vehicle) {
    throw new Error(result.reason || result.error || `Failed to mark vehicle as ${action}`);
  }

  return result.vehicle;
}

export const markVehicleAsSold = async (
  vehicleId: number,
  vehicles: Vehicle[],
  options?: VehicleActionOptions,
): Promise<Vehicle> => postVehicleAction('sold', vehicleId, vehicles, options);

export const markVehicleAsUnsold = async (
  vehicleId: number,
  vehicles: Vehicle[],
  options?: VehicleActionOptions,
): Promise<Vehicle> => postVehicleAction('unsold', vehicleId, vehicles, options);
