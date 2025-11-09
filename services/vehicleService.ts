
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
    // Try localStorage first for persistent login, fallback to sessionStorage
    const userJson = localStorage.getItem('reRideCurrentUser') || sessionStorage.getItem('currentUser');
    if (!userJson) return {};
    const user: User = JSON.parse(userJson);
    
    // Check if user has access token
    const accessToken = localStorage.getItem('reRideAccessToken') || sessionStorage.getItem('accessToken');
    if (accessToken) {
      return { 'Authorization': `Bearer ${accessToken}` };
    }
    
    // Fallback to email for backward compatibility (not recommended for production)
    console.warn('No access token found, using email for authorization (not secure)');
    return { 'Authorization': user.email };
  } catch (error) {
    console.error('Failed to get auth header:', error);
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
        console.log('getVehiclesLocal: Starting...');
        let vehiclesJson = localStorage.getItem('reRideVehicles');
        if (!vehiclesJson) {
            console.log('getVehiclesLocal: No cached data, loading MOCK_VEHICLES...');
            // Dynamically import MOCK_VEHICLES to avoid blocking initial load
            const { MOCK_VEHICLES } = await import('../constants');
            localStorage.setItem('reRideVehicles', JSON.stringify(MOCK_VEHICLES));
            vehiclesJson = JSON.stringify(MOCK_VEHICLES);
        } else {
            console.log('getVehiclesLocal: Using cached data');
        }
        const vehicles = JSON.parse(vehiclesJson);
        console.log('getVehiclesLocal: Successfully loaded', vehicles.length, 'vehicles');
        return vehicles;
    } catch (error) {
        console.error('getVehiclesLocal: Error loading vehicles:', error);
        // Return FALLBACK_VEHICLES as final fallback
        console.log('getVehiclesLocal: Returning FALLBACK_VEHICLES as fallback');
        return FALLBACK_VEHICLES;
    }
};

const addVehicleLocal = async (vehicleData: Vehicle): Promise<Vehicle> => {
    try {
        const vehicles = await getVehiclesLocal();
        vehicles.unshift(vehicleData);
        localStorage.setItem('reRideVehicles', JSON.stringify(vehicles));
        return vehicleData;
    } catch (error) {
        // Handle quota exceeded error
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('⚠️ LocalStorage quota exceeded, clearing old data...');
            // Clear old vehicles and try again
            localStorage.removeItem('reRideVehicles');
            const freshVehicles = [vehicleData];
            localStorage.setItem('reRideVehicles', JSON.stringify(freshVehicles));
            return vehicleData;
        }
        throw error;
    }
};

const updateVehicleLocal = async (vehicleData: Vehicle): Promise<Vehicle> => {
    let vehicles = await getVehiclesLocal();
    vehicles = vehicles.map(v => v.id === vehicleData.id ? vehicleData : v);
    localStorage.setItem('reRideVehicles', JSON.stringify(vehicles));
    return vehicleData;
};

const deleteVehicleLocal = async (vehicleId: number): Promise<{ success: boolean, id: number }> => {
    let vehicles = await getVehiclesLocal();
    vehicles = vehicles.filter(v => v.id !== vehicleId);
    localStorage.setItem('reRideVehicles', JSON.stringify(vehicles));
    return { success: true, id: vehicleId };
};


// --- Production (API) Functions ---

const getVehiclesApi = async (): Promise<Vehicle[]> => {
  const response = await fetch('/api/vehicles', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });
  const data = await handleResponse<Vehicle[]>(response);
  
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
  const authHeaders = getAuthHeader();
  const response = await fetch('/api/vehicles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    },
    credentials: 'include',
    body: JSON.stringify(vehicleData),
  });
  return handleResponse(response);
};

const updateVehicleApi = async (vehicleData: Vehicle): Promise<Vehicle> => {
  const authHeaders = getAuthHeader();
  const response = await fetch('/api/vehicles', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    },
    credentials: 'include',
    body: JSON.stringify(vehicleData),
  });
  return handleResponse(response);
};

const deleteVehicleApi = async (vehicleId: number): Promise<{ success: boolean, id: number }> => {
  const authHeaders = getAuthHeader();
  const response = await fetch('/api/vehicles', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    },
    credentials: 'include',
    body: JSON.stringify({ id: vehicleId }),
  });
  return handleResponse(response);
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
    console.log('getVehicles: Starting, isDevelopment:', isDevelopment());
    // Always try API first for production, with fallback to local
    if (!isDevelopment()) {
      try {
        console.log('getVehicles: Trying API...');
        const result = await getVehiclesApi();
        console.log('getVehicles: API success, loaded', result.length, 'vehicles');
        return result;
      } catch (error) {
        console.warn('getVehicles: API failed, falling back to local storage:', error);
        // Fallback to local storage if API fails
        return await getVehiclesLocal();
      }
    } else {
      // Development mode - use local storage
      console.log('getVehicles: Development mode, using local storage');
      return await getVehiclesLocal();
    }
  } catch (error) {
    console.error('getVehicles: Critical error, returning fallback:', error);
    // Last resort fallback
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
