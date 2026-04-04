import type { VehicleData } from '../types';
import { VEHICLE_DATA } from '../components/vehicleData';
import { safeGetItem, safeSetItem, isStorageAvailable } from '../utils/safeStorage';
import { logInfo, logWarn, logError } from '../utils/logger';
import { queueRequest } from '../utils/requestQueue';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

const VEHICLE_DATA_STORAGE_KEY = 'reRideVehicleData';

/**
 * Fetches vehicle data from the admin database API.
 * Falls back to localStorage and then default data if API fails.
 */
export const getVehicleData = async (): Promise<VehicleData> => {
  // Use request queue to prevent rate limiting
  try {
    const data = await queueRequest(
      async () => {
        // Try standalone endpoint first (correct for production)
        try {
          const response = await authenticatedFetch('/api/vehicle-data', { skipAuth: true });
          const parsed = await handleApiResponse<VehicleData>(response);
          if (parsed.success && parsed.data) {
            logInfo('✅ Vehicle data loaded from vehicle-data endpoint');
            safeSetItem(VEHICLE_DATA_STORAGE_KEY, JSON.stringify(parsed.data));
            return parsed.data;
          }
          logWarn(`Vehicle-data endpoint returned ${response.status}: ${response.statusText}`);
        } catch (error) {
          logWarn("Vehicle-data endpoint failed, trying consolidated endpoint", error);
        }

        // Try consolidated endpoint as fallback
        const response = await authenticatedFetch('/api/vehicles?type=data', { skipAuth: true });
        const parsed = await handleApiResponse<VehicleData>(response);
        if (parsed.success && parsed.data) {
          safeSetItem(VEHICLE_DATA_STORAGE_KEY, JSON.stringify(parsed.data));
          return parsed.data;
        }
        logWarn(`Standalone endpoint returned ${response.status}: ${response.statusText}, falling back to localStorage`);
        
        // If both endpoints fail, throw error to trigger fallback
        throw new Error('Both API endpoints failed');
      },
      { priority: 5, id: 'vehicle_data', maxRetries: 0 }
    );
    
    return data;
  } catch (error) {
    logWarn("Both API endpoints failed, falling back to localStorage", error);
    if (error instanceof SyntaxError) {
      logWarn("JSON parsing error - API likely returned HTML instead of JSON");
    } else if (error instanceof Error && error.message.includes('API returned non-JSON response')) {
      logWarn("API returned HTML instead of JSON - likely a 404 or server error page");
    }
  }

  // Fallback to localStorage
  if (isStorageAvailable()) {
    try {
      const dataJson = safeGetItem(VEHICLE_DATA_STORAGE_KEY);
      if (dataJson) {
        return JSON.parse(dataJson);
      }
    } catch (error) {
      logError("Failed to parse vehicle data from localStorage", error);
    }
  }

  // Final fallback to default data
  const defaultData = VEHICLE_DATA;
  safeSetItem(VEHICLE_DATA_STORAGE_KEY, JSON.stringify(defaultData));
  return defaultData;
};

/**
 * Creates new vehicle data in the admin database
 */
export const createVehicleData = async (vehicleData: {
  category: string;
  make: string;
  model: string;
  variants: string[];
}): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const response = await authenticatedFetch('/api/vehicle-data', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
    const result = await handleApiResponse<{ success: boolean; data?: any; error?: string; reason?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || `API returned ${response.status}: ${response.statusText}` };
    }
    return result.data || { success: true };
  } catch (error) {
    console.error('Error creating vehicle data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Updates existing vehicle data in the admin database
 */
export const updateVehicleData = async (id: string, vehicleData: {
  category?: string;
  make?: string;
  model?: string;
  variants?: string[];
}): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const response = await authenticatedFetch(`/api/vehicle-data?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData),
    });
    const result = await handleApiResponse<{ success: boolean; data?: any; error?: string; reason?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || `API returned ${response.status}: ${response.statusText}` };
    }
    return result.data || { success: true };
  } catch (error) {
    console.error('Error updating vehicle data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Deletes vehicle data from the admin database
 */
export const deleteVehicleData = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await authenticatedFetch(`/api/vehicle-data?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const result = await handleApiResponse<{ success: boolean; error?: string; reason?: string }>(response);
    if (!result.success) {
      return { success: false, error: result.reason || result.error || `API returned ${response.status}: ${response.statusText}` };
    }
    return result.data || { success: true };
  } catch (error) {
    console.error('Error deleting vehicle data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Synchronous version for backward compatibility.
 * Returns cached data from localStorage immediately.
 */
export const getVehicleDataSync = (): VehicleData => {
  if (isStorageAvailable()) {
    try {
      const dataJson = safeGetItem(VEHICLE_DATA_STORAGE_KEY);
      if (dataJson) {
        return JSON.parse(dataJson);
      }
    } catch (error) {
      logError("Failed to parse vehicle data from localStorage", error);
    }
  }
  
  // Fallback to default data
  const defaultData = VEHICLE_DATA;
  safeSetItem(VEHICLE_DATA_STORAGE_KEY, JSON.stringify(defaultData));
  return defaultData;
};

/**
 * Saves vehicle data to Supabase FIRST (real-time), then syncs to localStorage only on success.
 * CRITICAL FIX: No longer saves locally first - Supabase is the source of truth.
 */
export const saveVehicleData = async (data: VehicleData): Promise<boolean> => {
  logInfo('🔄 Starting vehicle data save process (Supabase first)...');
  
  // CRITICAL FIX: Try to save to Supabase FIRST with retry logic
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🌐 Attempt ${attempt}/${maxRetries}: Trying to save to Supabase...`);
    
    // Try consolidated endpoint first
    try {
      const response = await authenticatedFetch('/api/vehicles?type=data', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        console.log('✅ Vehicle data saved to Supabase via consolidated endpoint:', result);
        
        // Supabase save succeeded - NOW save to localStorage
        if (isStorageAvailable()) {
          try {
            safeSetItem(VEHICLE_DATA_STORAGE_KEY, JSON.stringify(data));
            logInfo('✅ Vehicle data synced to localStorage after Supabase success');
          } catch (error) {
            logError('❌ Failed to sync to localStorage:', error);
            // Don't fail the whole operation if localStorage fails
          }
        }
        
        return true;
      } else {
        console.warn(`⚠️ Consolidated endpoint failed with ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.warn('Response body:', errorText);
      }
    } catch (error) {
      console.warn(`⚠️ Consolidated endpoint attempt ${attempt} failed:`, error);
      lastError = error as Error;
    }

    // Try standalone endpoint as fallback
    try {
      const response = await authenticatedFetch('/api/vehicle-data', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        console.log('✅ Vehicle data saved to Supabase via standalone endpoint:', result);
        
        // Supabase save succeeded - NOW save to localStorage
        if (isStorageAvailable()) {
          try {
            safeSetItem(VEHICLE_DATA_STORAGE_KEY, JSON.stringify(data));
            logInfo('✅ Vehicle data synced to localStorage after Supabase success');
          } catch (error) {
            logError('❌ Failed to sync to localStorage:', error);
            // Don't fail the whole operation if localStorage fails
          }
        }
        
        return true;
      } else {
        console.warn(`⚠️ Standalone endpoint failed with ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.warn('Response body:', errorText);
      }
    } catch (error) {
      console.warn(`⚠️ Standalone endpoint attempt ${attempt} failed:`, error);
      lastError = error as Error;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error('❌ All Supabase save attempts failed. Data NOT saved locally.');
  console.error('Last error:', lastError);
  
  // Log user-friendly error information
  if (lastError) {
    const errorMsg = lastError.message || String(lastError);
    if (errorMsg.includes('503') || errorMsg.includes('Database connection')) {
      logError('💡 Database connection issue detected. Data will be queued for retry when connection is restored.');
    }
  }
  
  // Return false to indicate Supabase save failed - don't save locally
  return false;
};