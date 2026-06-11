/**
 * Vehicle Specifications Auto-Fetch Service
 * Uses free APIs to automatically populate vehicle specs when Vehicle Overview is filled
 * 
 * Features:
 * - Local Indian vehicle database (instant lookup)
 * - CarQuery API via backend proxy (free, no key; avoids browser CORS)
 * - Gemini AI fallback (via parent component)
 * - Auto-caching with configurable TTL
 * - LocalStorage persistence for offline access
 * - Automatic cache refresh
 */

import type { Vehicle } from '../types.js';
import { publicApiFetch } from '../utils/apiFetch.js';

export interface VehicleSpecs {
  engine?: string;
  transmission?: string;
  fuelType?: string;
  fuelEfficiency?: string;
  displacement?: string;
  groundClearance?: string;
  bootSpace?: string;
}

export const VEHICLE_SPEC_FIELDS = [
  'engine',
  'transmission',
  'fuelType',
  'fuelEfficiency',
  'displacement',
  'groundClearance',
  'bootSpace',
] as const;

export type VehicleSpecField = (typeof VEHICLE_SPEC_FIELDS)[number];

/** Generic new-listing defaults — treat as empty until engine is filled. */
export function isSpecFieldEmptyForAutofill(
  current: Partial<VehicleSpecs>,
  field: VehicleSpecField,
): boolean {
  const value = current[field];
  if (value === undefined || value === null || String(value).trim() === '' || value === 'N/A') {
    return true;
  }
  if (!current.engine?.trim()) {
    if (field === 'transmission' && value === 'Automatic') return true;
    if (field === 'fuelType' && value === 'Petrol') return true;
  }
  return false;
}

/** Build updates for empty spec fields only. */
export function buildSpecFieldUpdates(
  current: Partial<VehicleSpecs>,
  incoming: Partial<VehicleSpecs>,
): Partial<VehicleSpecs> {
  const updates: Partial<VehicleSpecs> = {};
  for (const field of VEHICLE_SPEC_FIELDS) {
    const next = incoming[field];
    if (next && next !== 'N/A' && isSpecFieldEmptyForAutofill(current, field)) {
      updates[field] = next;
    }
  }
  return updates;
}

// ============================================
// CACHE CONFIGURATION & MANAGEMENT
// ============================================

interface CachedSpecs {
  specs: VehicleSpecs;
  timestamp: number;
  source: 'local' | 'api' | 'ai';
}

// Cache TTL: 7 days for API data, 30 days for local DB data
const CACHE_TTL_API = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const CACHE_TTL_LOCAL = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
const CACHE_STORAGE_KEY = 'reride_vehicle_specs_cache';
const CACHE_VERSION = 'v1';

// In-memory cache for fast access
const specsCache = new Map<string, CachedSpecs>();

// Load cache from localStorage on module init
const loadCacheFromStorage = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!stored) return;
    
    const parsed = JSON.parse(stored);
    if (parsed.version !== CACHE_VERSION) {
      // Cache version mismatch, clear old cache
      localStorage.removeItem(CACHE_STORAGE_KEY);
      return;
    }
    
    const entries = parsed.entries as [string, CachedSpecs][];
    const now = Date.now();
    
    entries.forEach(([key, value]) => {
      const ttl = value.source === 'local' ? CACHE_TTL_LOCAL : CACHE_TTL_API;
      if (now - value.timestamp < ttl) {
        specsCache.set(key, value);
      }
    });
    
    console.log(`📦 Loaded ${specsCache.size} cached vehicle specs from storage`);
  } catch (error) {
    console.error('Failed to load specs cache:', error);
  }
};

// Save cache to localStorage
const saveCacheToStorage = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const entries = Array.from(specsCache.entries());
    const data = {
      version: CACHE_VERSION,
      entries,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save specs cache:', error);
  }
};

// Debounced save to avoid excessive writes
let saveTimeout: NodeJS.Timeout | null = null;
const debouncedSave = (): void => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveCacheToStorage, 2000);
};

// Initialize cache on module load
if (typeof window !== 'undefined') {
  loadCacheFromStorage();
}

// Create cache key from vehicle details
const createCacheKey = (make: string, model: string, year: number): string => {
  return `${make.toLowerCase().trim()}_${model.toLowerCase().trim()}_${year}`;
};

// Get from cache if valid
const getFromCache = (key: string): VehicleSpecs | null => {
  const cached = specsCache.get(key);
  if (!cached) return null;
  
  const ttl = cached.source === 'local' ? CACHE_TTL_LOCAL : CACHE_TTL_API;
  if (Date.now() - cached.timestamp > ttl) {
    specsCache.delete(key);
    return null;
  }
  
  return cached.specs;
};

// Add to cache
const addToCache = (key: string, specs: VehicleSpecs, source: 'local' | 'api' | 'ai'): void => {
  specsCache.set(key, {
    specs,
    timestamp: Date.now(),
    source,
  });
  debouncedSave();
};

// Force refresh cache for a specific vehicle
export const refreshVehicleSpecsCache = async (
  make: string,
  model: string,
  year: number
): Promise<VehicleSpecs | null> => {
  const key = createCacheKey(make, model, year);
  specsCache.delete(key);
  return fetchVehicleSpecs(make, model, year);
};

// Clear all cached specs
export const clearVehicleSpecsCache = (): void => {
  specsCache.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  }
  console.log('🗑️ Vehicle specs cache cleared');
};

// Get cache statistics
export const getVehicleSpecsCacheStats = (): {
  totalEntries: number;
  localEntries: number;
  apiEntries: number;
  aiEntries: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
} => {
  let localCount = 0;
  let apiCount = 0;
  let aiCount = 0;
  let oldest = Infinity;
  let newest = 0;
  
  specsCache.forEach((value) => {
    if (value.source === 'local') localCount++;
    else if (value.source === 'api') apiCount++;
    else aiCount++;
    
    if (value.timestamp < oldest) oldest = value.timestamp;
    if (value.timestamp > newest) newest = value.timestamp;
  });
  
  return {
    totalEntries: specsCache.size,
    localEntries: localCount,
    apiEntries: apiCount,
    aiEntries: aiCount,
    oldestEntry: oldest === Infinity ? null : new Date(oldest),
    newestEntry: newest === 0 ? null : new Date(newest),
  };
};

/**
 * Fetch vehicle specifications via backend proxy (CarQuery blocks browser CORS).
 */
export const fetchVehicleSpecsFromCarQuery = async (
  make: string,
  model: string,
  year: number,
): Promise<VehicleSpecs | null> => {
  try {
    const params = new URLSearchParams({
      make: make.trim(),
      model: model.trim(),
      year: String(year),
    });
    console.log('🚗 Fetching specs via /api/vehicle-specs:', { make, model, year });

    const response = await publicApiFetch(`/api/vehicle-specs?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.log('Vehicle specs API returned non-OK status:', response.status);
      return null;
    }

    const data = (await response.json()) as { success?: boolean; specs?: VehicleSpecs | null };
    if (!data.success || !data.specs?.engine) {
      return null;
    }

    console.log('✅ Specs received from CarQuery proxy');
    return data.specs;
  } catch (error) {
    console.error('CarQuery proxy error:', error);
    return null;
  }
};

/**
 * Indian vehicle specifications database
 * Common Indian market vehicles with their typical specifications
 */
const indianVehicleSpecs: Record<string, VehicleSpecs> = {
  // Maruti Suzuki
  'maruti suzuki_swift': { engine: '1.2L Petrol 90 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '22 KMPL', displacement: '1197 cc', groundClearance: '163 mm', bootSpace: '268 litres' },
  'maruti suzuki_baleno': { engine: '1.2L Petrol 90 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '22 KMPL', displacement: '1197 cc', groundClearance: '170 mm', bootSpace: '318 litres' },
  'maruti suzuki_brezza': { engine: '1.5L Petrol 103 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '17 KMPL', displacement: '1462 cc', groundClearance: '198 mm', bootSpace: '328 litres' },
  'maruti suzuki_ertiga': { engine: '1.5L Petrol 103 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1462 cc', groundClearance: '185 mm', bootSpace: '209 litres' },
  'maruti suzuki_dzire': { engine: '1.2L Petrol 90 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '23 KMPL', displacement: '1197 cc', groundClearance: '163 mm', bootSpace: '378 litres' },
  'maruti suzuki_alto': { engine: '0.8L Petrol 48 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '22 KMPL', displacement: '796 cc', groundClearance: '160 mm', bootSpace: '177 litres' },
  'maruti suzuki_wagon r': { engine: '1.0L Petrol 67 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '24 KMPL', displacement: '998 cc', groundClearance: '180 mm', bootSpace: '341 litres' },
  'maruti suzuki_celerio': { engine: '1.0L Petrol 67 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '26 KMPL', displacement: '998 cc', groundClearance: '165 mm', bootSpace: '313 litres' },
  'maruti suzuki_grand vitara': { engine: '1.5L Petrol 103 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '21 KMPL', displacement: '1462 cc', groundClearance: '210 mm', bootSpace: '373 litres' },
  'maruti suzuki_fronx': { engine: '1.2L Petrol 90 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '22 KMPL', displacement: '1197 cc', groundClearance: '190 mm', bootSpace: '308 litres' },
  'maruti suzuki_jimny': { engine: '1.5L Petrol 105 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '16 KMPL', displacement: '1462 cc', groundClearance: '210 mm', bootSpace: '208 litres' },
  'maruti suzuki_invicto': { engine: '2.0L Hybrid 184 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '23 KMPL', displacement: '1987 cc', groundClearance: '185 mm', bootSpace: '326 litres' },
  'maruti suzuki_xl6': { engine: '1.5L Petrol 103 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1462 cc', groundClearance: '185 mm', bootSpace: '209 litres' },
  'maruti suzuki_ciaz': { engine: '1.5L Petrol 103 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '1462 cc', groundClearance: '170 mm', bootSpace: '510 litres' },
  'maruti suzuki_s-presso': { engine: '1.0L Petrol 67 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '25 KMPL', displacement: '998 cc', groundClearance: '180 mm', bootSpace: '270 litres' },
  'maruti suzuki_ignis': { engine: '1.2L Petrol 83 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '1197 cc', groundClearance: '180 mm', bootSpace: '260 litres' },
  // Hyundai
  'hyundai_creta': { engine: '1.5L Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '17 KMPL', displacement: '1497 cc', groundClearance: '190 mm', bootSpace: '433 litres' },
  'hyundai_i20': { engine: '1.2L Petrol 88 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '1197 cc', groundClearance: '170 mm', bootSpace: '311 litres' },
  'hyundai_venue': { engine: '1.2L Petrol 83 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '17 KMPL', displacement: '1197 cc', groundClearance: '195 mm', bootSpace: '350 litres' },
  'hyundai_verna': { engine: '1.5L Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1497 cc', groundClearance: '165 mm', bootSpace: '480 litres' },
  'hyundai_tucson': { engine: '2.0L Petrol 156 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '14 KMPL', displacement: '1999 cc', groundClearance: '192 mm', bootSpace: '539 litres' },
  'hyundai_grand i10 nios': { engine: '1.2L Petrol 83 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '1197 cc', groundClearance: '165 mm', bootSpace: '260 litres' },
  'hyundai_aura': { engine: '1.2L Petrol 83 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '1197 cc', groundClearance: '165 mm', bootSpace: '402 litres' },
  'hyundai_exter': { engine: '1.2L Petrol 83 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1197 cc', groundClearance: '185 mm', bootSpace: '391 litres' },
  'hyundai_alcazar': { engine: '1.5L Turbo Petrol 160 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '15 KMPL', displacement: '1482 cc', groundClearance: '200 mm', bootSpace: '180 litres' },
  'hyundai_ioniq 5': { engine: 'Electric 217 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '631 km range', displacement: 'N/A', groundClearance: '160 mm', bootSpace: '527 litres' },
  'hyundai_kona electric': { engine: 'Electric 136 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '452 km range', displacement: 'N/A', groundClearance: '170 mm', bootSpace: '332 litres' },
  'hyundai_xcent': { engine: '1.2L Petrol 83 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1197 cc', groundClearance: '165 mm', bootSpace: '407 litres' },
  'hyundai_santro': { engine: '1.1L Petrol 69 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '1086 cc', groundClearance: '160 mm', bootSpace: '235 litres' },
  // Tata
  'tata_nexon': { engine: '1.2L Turbo Petrol 120 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '17 KMPL', displacement: '1199 cc', groundClearance: '209 mm', bootSpace: '350 litres' },
  'tata_punch': { engine: '1.2L Petrol 86 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1199 cc', groundClearance: '187 mm', bootSpace: '366 litres' },
  'tata_harrier': { engine: '2.0L Diesel 170 BHP', transmission: 'Manual', fuelType: 'Diesel', fuelEfficiency: '14 KMPL', displacement: '1956 cc', groundClearance: '205 mm', bootSpace: '425 litres' },
  'tata_safari': { engine: '2.0L Diesel 170 BHP', transmission: 'Manual', fuelType: 'Diesel', fuelEfficiency: '14 KMPL', displacement: '1956 cc', groundClearance: '205 mm', bootSpace: '447 litres' },
  'tata_altroz': { engine: '1.2L Petrol 86 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1199 cc', groundClearance: '165 mm', bootSpace: '345 litres' },
  'tata_tiago': { engine: '1.2L Petrol 86 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1199 cc', groundClearance: '170 mm', bootSpace: '242 litres' },
  'tata_tigor': { engine: '1.2L Petrol 86 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1199 cc', groundClearance: '170 mm', bootSpace: '419 litres' },
  'tata_nexon ev': { engine: 'Electric 143 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '437 km range', displacement: 'N/A', groundClearance: '209 mm', bootSpace: '350 litres' },
  'tata_tiago ev': { engine: 'Electric 75 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '315 km range', displacement: 'N/A', groundClearance: '165 mm', bootSpace: '240 litres' },
  'tata_curvv': { engine: '1.2L Turbo Petrol 125 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '17 KMPL', displacement: '1199 cc', groundClearance: '190 mm', bootSpace: '500 litres' },
  'tata_curvv ev': { engine: 'Electric 167 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '585 km range', displacement: 'N/A', groundClearance: '190 mm', bootSpace: '500 litres' },
  // Mahindra
  'mahindra_thar': { engine: '2.0L Turbo Petrol 152 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '15 KMPL', displacement: '1997 cc', groundClearance: '226 mm', bootSpace: '288 litres' },
  'mahindra_xuv700': { engine: '2.0L Turbo Petrol 200 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '13 KMPL', displacement: '1997 cc', groundClearance: '200 mm', bootSpace: '451 litres' },
  'mahindra_xuv300': { engine: '1.2L Turbo Petrol 110 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '17 KMPL', displacement: '1197 cc', groundClearance: '180 mm', bootSpace: '257 litres' },
  'mahindra_scorpio n': { engine: '2.0L Turbo Petrol 200 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '12 KMPL', displacement: '1997 cc', groundClearance: '203 mm', bootSpace: '460 litres' },
  'mahindra_bolero': { engine: '1.5L Diesel 76 BHP', transmission: 'Manual', fuelType: 'Diesel', fuelEfficiency: '16 KMPL', displacement: '1493 cc', groundClearance: '180 mm', bootSpace: '357 litres' },
  'mahindra_xuv400 ev': { engine: 'Electric 150 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '456 km range', displacement: 'N/A', groundClearance: '180 mm', bootSpace: '378 litres' },
  'mahindra_xuv 3xo': { engine: '1.2L Turbo Petrol 130 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1197 cc', groundClearance: '195 mm', bootSpace: '364 litres' },
  'mahindra_be 6': { engine: 'Electric 286 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '535 km range', displacement: 'N/A', groundClearance: '207 mm', bootSpace: '455 litres' },
  // Kia
  'kia_seltos': { engine: '1.5L Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '16 KMPL', displacement: '1497 cc', groundClearance: '190 mm', bootSpace: '433 litres' },
  'kia_sonet': { engine: '1.2L Petrol 83 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1197 cc', groundClearance: '205 mm', bootSpace: '392 litres' },
  'kia_carens': { engine: '1.5L Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '16 KMPL', displacement: '1497 cc', groundClearance: '195 mm', bootSpace: '216 litres' },
  'kia_ev6': { engine: 'Electric 325 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '528 km range', displacement: 'N/A', groundClearance: '160 mm', bootSpace: '490 litres' },
  'kia_carnival': { engine: '2.2L Diesel 200 BHP', transmission: 'Automatic', fuelType: 'Diesel', fuelEfficiency: '13 KMPL', displacement: '2199 cc', groundClearance: '175 mm', bootSpace: '540 litres' },
  'kia_ev9': { engine: 'Electric 385 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '541 km range', displacement: 'N/A', groundClearance: '185 mm', bootSpace: '333 litres' },
  // Toyota
  'toyota_fortuner': { engine: '2.8L Diesel 204 BHP', transmission: 'Automatic', fuelType: 'Diesel', fuelEfficiency: '10 KMPL', displacement: '2755 cc', groundClearance: '225 mm', bootSpace: '296 litres' },
  'toyota_innova': { engine: '2.4L Diesel 150 BHP', transmission: 'Manual', fuelType: 'Diesel', fuelEfficiency: '12 KMPL', displacement: '2393 cc', groundClearance: '176 mm', bootSpace: '300 litres' },
  'toyota_innova crysta': { engine: '2.4L Diesel 150 BHP', transmission: 'Manual', fuelType: 'Diesel', fuelEfficiency: '12 KMPL', displacement: '2393 cc', groundClearance: '176 mm', bootSpace: '300 litres' },
  'toyota_innova hycross': { engine: '2.0L Hybrid 186 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '21 KMPL', displacement: '1987 cc', groundClearance: '185 mm', bootSpace: '239 litres' },
  'toyota_urban cruiser hyryder': { engine: '1.5L Hybrid 116 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '27 KMPL', displacement: '1462 cc', groundClearance: '210 mm', bootSpace: '265 litres' },
  'toyota_urban cruiser taisor': { engine: '1.2L Petrol 90 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '22 KMPL', displacement: '1197 cc', groundClearance: '180 mm', bootSpace: '308 litres' },
  'toyota_glanza': { engine: '1.2L Petrol 90 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '22 KMPL', displacement: '1197 cc', groundClearance: '170 mm', bootSpace: '318 litres' },
  'toyota_rumion': { engine: '1.5L Petrol 103 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1462 cc', groundClearance: '180 mm', bootSpace: '209 litres' },
  'toyota_land cruiser': { engine: '3.4L V6 Turbo Diesel 309 BHP', transmission: 'Automatic', fuelType: 'Diesel', fuelEfficiency: '8 KMPL', displacement: '3346 cc', groundClearance: '230 mm', bootSpace: '318 litres' },
  'toyota_camry': { engine: '2.5L Hybrid 215 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '19 KMPL', displacement: '2487 cc', groundClearance: '160 mm', bootSpace: '428 litres' },
  'toyota_vellfire': { engine: '2.5L Hybrid 197 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '16 KMPL', displacement: '2487 cc', groundClearance: '170 mm', bootSpace: '225 litres' },
  // Honda
  'honda_city': { engine: '1.5L Petrol 121 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1498 cc', groundClearance: '165 mm', bootSpace: '506 litres' },
  'honda_elevate': { engine: '1.5L Petrol 121 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '16 KMPL', displacement: '1498 cc', groundClearance: '220 mm', bootSpace: '458 litres' },
  'honda_amaze': { engine: '1.2L Petrol 90 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1199 cc', groundClearance: '170 mm', bootSpace: '420 litres' },
  // MG
  'mg_hector': { engine: '1.5L Turbo Petrol 143 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '14 KMPL', displacement: '1451 cc', groundClearance: '192 mm', bootSpace: '587 litres' },
  'mg_astor': { engine: '1.5L Petrol 110 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '15 KMPL', displacement: '1498 cc', groundClearance: '186 mm', bootSpace: '448 litres' },
  'mg_zs ev': { engine: 'Electric 177 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '461 km range', displacement: 'N/A', groundClearance: '177 mm', bootSpace: '470 litres' },
  'mg_comet ev': { engine: 'Electric 42 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '230 km range', displacement: 'N/A', groundClearance: '160 mm', bootSpace: '313 litres' },
  'mg_gloster': { engine: '2.0L Twin Turbo Diesel 218 BHP', transmission: 'Automatic', fuelType: 'Diesel', fuelEfficiency: '10 KMPL', displacement: '1996 cc', groundClearance: '210 mm', bootSpace: '468 litres' },
  'mg_windsor ev': { engine: 'Electric 136 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '332 km range', displacement: 'N/A', groundClearance: '200 mm', bootSpace: '604 litres' },
  // Skoda
  'skoda_slavia': { engine: '1.0L Turbo Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '999 cc', groundClearance: '179 mm', bootSpace: '521 litres' },
  'skoda_kushaq': { engine: '1.0L Turbo Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '999 cc', groundClearance: '188 mm', bootSpace: '385 litres' },
  'skoda_kodiaq': { engine: '2.0L TSI 190 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '12 KMPL', displacement: '1984 cc', groundClearance: '194 mm', bootSpace: '270 litres' },
  'skoda_superb': { engine: '2.0L TSI 190 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '13 KMPL', displacement: '1984 cc', groundClearance: '162 mm', bootSpace: '625 litres' },
  // Volkswagen
  'volkswagen_taigun': { engine: '1.0L Turbo Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '999 cc', groundClearance: '188 mm', bootSpace: '385 litres' },
  'volkswagen_virtus': { engine: '1.0L Turbo Petrol 115 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '999 cc', groundClearance: '179 mm', bootSpace: '521 litres' },
  'volkswagen_tiguan': { engine: '2.0L TSI 190 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '12 KMPL', displacement: '1984 cc', groundClearance: '200 mm', bootSpace: '615 litres' },
  // Renault
  'renault_kiger': { engine: '1.0L Turbo Petrol 100 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '999 cc', groundClearance: '205 mm', bootSpace: '405 litres' },
  'renault_kwid': { engine: '1.0L Petrol 68 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '22 KMPL', displacement: '999 cc', groundClearance: '184 mm', bootSpace: '290 litres' },
  'renault_triber': { engine: '1.0L Petrol 72 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '999 cc', groundClearance: '182 mm', bootSpace: '84 litres' },
  // Nissan
  'nissan_magnite': { engine: '1.0L Turbo Petrol 100 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '20 KMPL', displacement: '999 cc', groundClearance: '205 mm', bootSpace: '336 litres' },
  // Citroen
  'citroen_c3': { engine: '1.2L Turbo Petrol 110 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '19 KMPL', displacement: '1199 cc', groundClearance: '180 mm', bootSpace: '315 litres' },
  'citroen_c3 aircross': { engine: '1.2L Turbo Petrol 110 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '18 KMPL', displacement: '1199 cc', groundClearance: '200 mm', bootSpace: '449 litres' },
  'citroen_ec3': { engine: 'Electric 57 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '320 km range', displacement: 'N/A', groundClearance: '180 mm', bootSpace: '315 litres' },
  // Jeep
  'jeep_compass': { engine: '2.0L Diesel 170 BHP', transmission: 'Manual', fuelType: 'Diesel', fuelEfficiency: '13 KMPL', displacement: '1956 cc', groundClearance: '205 mm', bootSpace: '438 litres' },
  'jeep_meridian': { engine: '2.0L Diesel 170 BHP', transmission: 'Automatic', fuelType: 'Diesel', fuelEfficiency: '12 KMPL', displacement: '1956 cc', groundClearance: '203 mm', bootSpace: '233 litres' },
  'jeep_wrangler': { engine: '2.0L Turbo Petrol 268 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '9 KMPL', displacement: '1995 cc', groundClearance: '256 mm', bootSpace: '142 litres' },
  'jeep_grand cherokee': { engine: '2.0L Turbo Petrol 272 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '1995 cc', groundClearance: '212 mm', bootSpace: '527 litres' },
  // BMW
  'bmw_3 series': { engine: '2.0L Turbo Petrol 258 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '14 KMPL', displacement: '1998 cc', groundClearance: '143 mm', bootSpace: '480 litres' },
  'bmw_5 series': { engine: '2.0L Turbo Petrol 252 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '13 KMPL', displacement: '1998 cc', groundClearance: '135 mm', bootSpace: '530 litres' },
  'bmw_x1': { engine: '2.0L Turbo Petrol 204 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '12 KMPL', displacement: '1998 cc', groundClearance: '195 mm', bootSpace: '540 litres' },
  'bmw_x3': { engine: '2.0L Turbo Petrol 252 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1998 cc', groundClearance: '204 mm', bootSpace: '550 litres' },
  'bmw_x5': { engine: '3.0L Turbo Petrol 340 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '2998 cc', groundClearance: '214 mm', bootSpace: '650 litres' },
  'bmw_7 series': { engine: '3.0L Turbo Petrol 375 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '2998 cc', groundClearance: '140 mm', bootSpace: '500 litres' },
  'bmw_i4': { engine: 'Electric 340 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '590 km range', displacement: 'N/A', groundClearance: '145 mm', bootSpace: '470 litres' },
  'bmw_i5': { engine: 'Electric 340 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '582 km range', displacement: 'N/A', groundClearance: '144 mm', bootSpace: '490 litres' },
  'bmw_ix': { engine: 'Electric 523 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '630 km range', displacement: 'N/A', groundClearance: '199 mm', bootSpace: '500 litres' },
  'bmw_2 series': { engine: '2.0L Turbo Petrol 258 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '13 KMPL', displacement: '1998 cc', groundClearance: '139 mm', bootSpace: '470 litres' },
  // Mercedes-Benz
  'mercedes-benz_c-class': { engine: '1.5L Turbo Petrol 204 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '14 KMPL', displacement: '1496 cc', groundClearance: '141 mm', bootSpace: '455 litres' },
  'mercedes-benz_e-class': { engine: '2.0L Turbo Petrol 258 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '12 KMPL', displacement: '1991 cc', groundClearance: '143 mm', bootSpace: '540 litres' },
  'mercedes-benz_gla': { engine: '2.0L Turbo Petrol 224 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '13 KMPL', displacement: '1991 cc', groundClearance: '205 mm', bootSpace: '435 litres' },
  'mercedes-benz_glc': { engine: '2.0L Turbo Petrol 258 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1991 cc', groundClearance: '204 mm', bootSpace: '620 litres' },
  'mercedes-benz_gle': { engine: '2.0L Turbo Petrol 258 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '1991 cc', groundClearance: '217 mm', bootSpace: '630 litres' },
  'mercedes-benz_s-class': { engine: '3.0L Turbo Petrol 367 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '2999 cc', groundClearance: '130 mm', bootSpace: '550 litres' },
  'mercedes-benz_a-class': { engine: '1.3L Turbo Petrol 163 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '17 KMPL', displacement: '1332 cc', groundClearance: '140 mm', bootSpace: '370 litres' },
  'mercedes-benz_eqa': { engine: 'Electric 190 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '560 km range', displacement: 'N/A', groundClearance: '185 mm', bootSpace: '340 litres' },
  'mercedes-benz_eqb': { engine: 'Electric 228 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '535 km range', displacement: 'N/A', groundClearance: '177 mm', bootSpace: '495 litres' },
  'mercedes-benz_eqs': { engine: 'Electric 523 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '770 km range', displacement: 'N/A', groundClearance: '149 mm', bootSpace: '610 litres' },
  'mercedes-benz_maybach': { engine: '4.0L V8 Turbo 503 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '8 KMPL', displacement: '3982 cc', groundClearance: '145 mm', bootSpace: '510 litres' },
  'mercedes-benz_amg gt': { engine: '4.0L V8 Turbo 585 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '8 KMPL', displacement: '3982 cc', groundClearance: '120 mm', bootSpace: '350 litres' },
  // Audi
  'audi_a4': { engine: '2.0L Turbo Petrol 201 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '14 KMPL', displacement: '1984 cc', groundClearance: '141 mm', bootSpace: '460 litres' },
  'audi_a6': { engine: '2.0L Turbo Petrol 245 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '12 KMPL', displacement: '1984 cc', groundClearance: '143 mm', bootSpace: '530 litres' },
  'audi_q3': { engine: '2.0L Turbo Petrol 190 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '13 KMPL', displacement: '1984 cc', groundClearance: '188 mm', bootSpace: '530 litres' },
  'audi_q5': { engine: '2.0L Turbo Petrol 261 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1984 cc', groundClearance: '200 mm', bootSpace: '520 litres' },
  'audi_q7': { engine: '3.0L Turbo Petrol 340 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '2995 cc', groundClearance: '235 mm', bootSpace: '865 litres' },
  'audi_q8': { engine: '3.0L Turbo Petrol 340 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '2995 cc', groundClearance: '214 mm', bootSpace: '605 litres' },
  'audi_e-tron': { engine: 'Electric 408 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '491 km range', displacement: 'N/A', groundClearance: '172 mm', bootSpace: '660 litres' },
  'audi_e-tron gt': { engine: 'Electric 476 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '488 km range', displacement: 'N/A', groundClearance: '138 mm', bootSpace: '405 litres' },
  // Land Rover / Range Rover
  'land rover_defender': { engine: '3.0L Turbo Petrol 400 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '9 KMPL', displacement: '2996 cc', groundClearance: '291 mm', bootSpace: '297 litres' },
  'land rover_discovery': { engine: '3.0L Turbo Diesel 300 BHP', transmission: 'Automatic', fuelType: 'Diesel', fuelEfficiency: '10 KMPL', displacement: '2997 cc', groundClearance: '283 mm', bootSpace: '258 litres' },
  'range rover_evoque': { engine: '2.0L Turbo Petrol 249 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1998 cc', groundClearance: '212 mm', bootSpace: '472 litres' },
  'range rover_velar': { engine: '2.0L Turbo Petrol 250 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1998 cc', groundClearance: '213 mm', bootSpace: '673 litres' },
  'range rover_sport': { engine: '3.0L Turbo Petrol 400 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '9 KMPL', displacement: '2996 cc', groundClearance: '275 mm', bootSpace: '780 litres' },
  'range rover_range rover': { engine: '3.0L Turbo Petrol 400 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '9 KMPL', displacement: '2996 cc', groundClearance: '295 mm', bootSpace: '818 litres' },
  // Volvo
  'volvo_xc40': { engine: '2.0L Turbo Petrol 197 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '12 KMPL', displacement: '1969 cc', groundClearance: '211 mm', bootSpace: '460 litres' },
  'volvo_xc60': { engine: '2.0L Turbo Petrol 250 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1969 cc', groundClearance: '216 mm', bootSpace: '483 litres' },
  'volvo_xc90': { engine: '2.0L Turbo Petrol 310 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '1969 cc', groundClearance: '238 mm', bootSpace: '302 litres' },
  'volvo_s90': { engine: '2.0L Turbo Petrol 250 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1969 cc', groundClearance: '155 mm', bootSpace: '500 litres' },
  'volvo_xc40 recharge': { engine: 'Electric 408 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '418 km range', displacement: 'N/A', groundClearance: '175 mm', bootSpace: '419 litres' },
  'volvo_c40 recharge': { engine: 'Electric 408 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '430 km range', displacement: 'N/A', groundClearance: '175 mm', bootSpace: '413 litres' },
  // Porsche
  'porsche_cayenne': { engine: '3.0L V6 Turbo 340 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '9 KMPL', displacement: '2995 cc', groundClearance: '193 mm', bootSpace: '770 litres' },
  'porsche_macan': { engine: '2.0L Turbo Petrol 265 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '11 KMPL', displacement: '1984 cc', groundClearance: '195 mm', bootSpace: '488 litres' },
  'porsche_taycan': { engine: 'Electric 408 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '450 km range', displacement: 'N/A', groundClearance: '131 mm', bootSpace: '407 litres' },
  'porsche_911': { engine: '3.0L Flat-6 Turbo 450 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '9 KMPL', displacement: '2981 cc', groundClearance: '110 mm', bootSpace: '128 litres' },
  'porsche_panamera': { engine: '2.9L V6 Turbo 330 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '10 KMPL', displacement: '2894 cc', groundClearance: '134 mm', bootSpace: '495 litres' },
  // Lexus
  'lexus_nx': { engine: '2.5L Hybrid 244 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '18 KMPL', displacement: '2487 cc', groundClearance: '180 mm', bootSpace: '520 litres' },
  'lexus_rx': { engine: '2.5L Hybrid 313 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '15 KMPL', displacement: '2487 cc', groundClearance: '200 mm', bootSpace: '612 litres' },
  'lexus_es': { engine: '2.5L Hybrid 215 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '22 KMPL', displacement: '2487 cc', groundClearance: '145 mm', bootSpace: '454 litres' },
  'lexus_ls': { engine: '3.5L V6 Hybrid 354 BHP', transmission: 'CVT', fuelType: 'Hybrid', fuelEfficiency: '14 KMPL', displacement: '3456 cc', groundClearance: '140 mm', bootSpace: '430 litres' },
  'lexus_lx': { engine: '3.5L Twin Turbo V6 409 BHP', transmission: 'Automatic', fuelType: 'Petrol', fuelEfficiency: '8 KMPL', displacement: '3444 cc', groundClearance: '230 mm', bootSpace: '357 litres' },
  // BYD
  'byd_atto 3': { engine: 'Electric 204 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '521 km range', displacement: 'N/A', groundClearance: '175 mm', bootSpace: '440 litres' },
  'byd_seal': { engine: 'Electric 313 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '650 km range', displacement: 'N/A', groundClearance: '150 mm', bootSpace: '400 litres' },
  'byd_e6': { engine: 'Electric 95 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '520 km range', displacement: 'N/A', groundClearance: '150 mm', bootSpace: '580 litres' },
  // Bikes - Royal Enfield
  'royal enfield_classic 350': { engine: '349cc Single 20.2 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '35 KMPL', displacement: '349 cc', groundClearance: '150 mm', bootSpace: 'N/A' },
  'royal enfield_bullet 350': { engine: '349cc Single 20.2 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '36 KMPL', displacement: '349 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'royal enfield_meteor 350': { engine: '349cc Single 20.2 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '35 KMPL', displacement: '349 cc', groundClearance: '170 mm', bootSpace: 'N/A' },
  'royal enfield_himalayan': { engine: '411cc Single 24.3 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '30 KMPL', displacement: '411 cc', groundClearance: '220 mm', bootSpace: 'N/A' },
  'royal enfield_interceptor 650': { engine: '648cc Twin 47 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '25 KMPL', displacement: '648 cc', groundClearance: '174 mm', bootSpace: 'N/A' },
  'royal enfield_continental gt 650': { engine: '648cc Twin 47 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '25 KMPL', displacement: '648 cc', groundClearance: '174 mm', bootSpace: 'N/A' },
  'royal enfield_hunter 350': { engine: '349cc Single 20.2 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '36 KMPL', displacement: '349 cc', groundClearance: '150 mm', bootSpace: 'N/A' },
  'royal enfield_super meteor 650': { engine: '648cc Twin 47 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '23 KMPL', displacement: '648 cc', groundClearance: '135 mm', bootSpace: 'N/A' },
  'royal enfield_shotgun 650': { engine: '648cc Twin 47 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '24 KMPL', displacement: '648 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  // Bikes - Honda
  'honda_activa': { engine: '109.51cc Single 7.79 BHP', transmission: 'CVT', fuelType: 'Petrol', fuelEfficiency: '55 KMPL', displacement: '109.51 cc', groundClearance: '171 mm', bootSpace: 'N/A' },
  'honda_cb350': { engine: '348.36cc Single 20.8 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '35 KMPL', displacement: '348 cc', groundClearance: '166 mm', bootSpace: 'N/A' },
  'honda_sp 125': { engine: '123.94cc Single 10.9 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '65 KMPL', displacement: '123.94 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  // Bikes - TVS
  'tvs_apache rtr 160': { engine: '159.7cc Single 17.63 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '50 KMPL', displacement: '159.7 cc', groundClearance: '180 mm', bootSpace: 'N/A' },
  'tvs_apache rtr 200': { engine: '197.75cc Single 20.5 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '40 KMPL', displacement: '197.75 cc', groundClearance: '180 mm', bootSpace: 'N/A' },
  'tvs_jupiter': { engine: '109.7cc Single 8 BHP', transmission: 'CVT', fuelType: 'Petrol', fuelEfficiency: '52 KMPL', displacement: '109.7 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'tvs_ntorq': { engine: '124.79cc Single 9.38 BHP', transmission: 'CVT', fuelType: 'Petrol', fuelEfficiency: '47 KMPL', displacement: '124.79 cc', groundClearance: '180 mm', bootSpace: 'N/A' },
  'tvs_raider': { engine: '124.8cc Single 11.4 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '55 KMPL', displacement: '124.8 cc', groundClearance: '180 mm', bootSpace: 'N/A' },
  // Bikes - Bajaj
  'bajaj_ct 100': { engine: '99.3cc Single 7.9 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '70 KMPL', displacement: '99.3 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'bajaj_ct100': { engine: '99.3cc Single 7.9 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '70 KMPL', displacement: '99.3 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'bajaj_platina': { engine: '102cc Single 7.8 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '72 KMPL', displacement: '102 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'bajaj_pulsar 150': { engine: '149.5cc Single 14 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '50 KMPL', displacement: '149.5 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'bajaj_dominar 400': { engine: '373.3cc Single 40 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '27 KMPL', displacement: '373.3 cc', groundClearance: '157 mm', bootSpace: 'N/A' },
  'bajaj_pulsar ns200': { engine: '199.5cc Single 24.5 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '35 KMPL', displacement: '199.5 cc', groundClearance: '169 mm', bootSpace: 'N/A' },
  // Bikes - KTM
  'ktm_duke 200': { engine: '199.5cc Single 25 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '35 KMPL', displacement: '199.5 cc', groundClearance: '178 mm', bootSpace: 'N/A' },
  'ktm_duke 390': { engine: '373.2cc Single 43 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '25 KMPL', displacement: '373.2 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'ktm_rc 390': { engine: '373.2cc Single 43 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '25 KMPL', displacement: '373.2 cc', groundClearance: '157 mm', bootSpace: 'N/A' },
  // Bikes - Yamaha
  'yamaha_mt-15': { engine: '155cc Single 18.4 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '45 KMPL', displacement: '155 cc', groundClearance: '170 mm', bootSpace: 'N/A' },
  'yamaha_r15': { engine: '155cc Single 18.4 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '45 KMPL', displacement: '155 cc', groundClearance: '170 mm', bootSpace: 'N/A' },
  'yamaha_fz-s': { engine: '149cc Single 12.4 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '50 KMPL', displacement: '149 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  // Bikes - Hero
  'hero_splendor': { engine: '97.2cc Single 7.9 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '70 KMPL', displacement: '97.2 cc', groundClearance: '165 mm', bootSpace: 'N/A' },
  'hero_xtreme 160r': { engine: '163cc Single 15 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '45 KMPL', displacement: '163 cc', groundClearance: '167 mm', bootSpace: 'N/A' },
  'hero_xpulse 200': { engine: '199.6cc Single 18.8 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '40 KMPL', displacement: '199.6 cc', groundClearance: '220 mm', bootSpace: 'N/A' },
  // Bikes - Suzuki
  'suzuki_access 125': { engine: '124cc Single 8.7 BHP', transmission: 'CVT', fuelType: 'Petrol', fuelEfficiency: '50 KMPL', displacement: '124 cc', groundClearance: '160 mm', bootSpace: 'N/A' },
  'suzuki_gixxer': { engine: '155cc Single 13.6 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '50 KMPL', displacement: '155 cc', groundClearance: '160 mm', bootSpace: 'N/A' },
  'suzuki_hayabusa': { engine: '1340cc Inline-4 190 BHP', transmission: 'Manual', fuelType: 'Petrol', fuelEfficiency: '15 KMPL', displacement: '1340 cc', groundClearance: '125 mm', bootSpace: 'N/A' },
  // Electric Bikes
  'ather_450x': { engine: 'Electric 9.4 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '116 km range', displacement: 'N/A', groundClearance: '165 mm', bootSpace: 'N/A' },
  'ola_s1 pro': { engine: 'Electric 11 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '181 km range', displacement: 'N/A', groundClearance: '165 mm', bootSpace: 'N/A' },
  'tvs_iqube': { engine: 'Electric 4.4 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '100 km range', displacement: 'N/A', groundClearance: '150 mm', bootSpace: 'N/A' },
  'bajaj_chetak': { engine: 'Electric 4.1 BHP', transmission: 'Automatic', fuelType: 'Electric', fuelEfficiency: '108 km range', displacement: 'N/A', groundClearance: '160 mm', bootSpace: 'N/A' },
};

/**
 * Fetch specs from local Indian vehicle database
 */
export const fetchSpecsFromLocalDB = (
  make: string,
  model: string
): VehicleSpecs | null => {
  // Create lookup key
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  
  // Try exact match first
  const exactKey = `${normalizedMake}_${normalizedModel}`;
  if (indianVehicleSpecs[exactKey]) {
    console.log('📋 Found exact match in local DB:', exactKey);
    return indianVehicleSpecs[exactKey];
  }
  
  // Try with different separators
  const altKey = `${normalizedMake}_${normalizedModel.replace(/ /g, '-')}`;
  if (indianVehicleSpecs[altKey]) {
    return indianVehicleSpecs[altKey];
  }

  const compactModel = normalizedModel.replace(/\s+/g, '');
  const compactKey = `${normalizedMake}_${compactModel}`;
  if (indianVehicleSpecs[compactKey]) {
    console.log('📋 Found compact match in local DB:', compactKey);
    return indianVehicleSpecs[compactKey];
  }
  
  // Try partial match
  for (const key of Object.keys(indianVehicleSpecs)) {
    const [dbMake, dbModel] = key.split('_');
    if (
      (normalizedMake.includes(dbMake) || dbMake.includes(normalizedMake)) &&
      (normalizedModel.includes(dbModel) || dbModel.includes(normalizedModel))
    ) {
      console.log('📋 Found partial match in local DB:', key);
      return indianVehicleSpecs[key];
    }
  }
  
  return null;
};

/**
 * Main function to fetch vehicle specifications
 * Priority: Cache → Local DB → CarQuery API → null (caller can fall back to Gemini AI)
 * 
 * Auto-caches results for faster subsequent lookups
 */
export const fetchVehicleSpecs = async (
  make: string,
  model: string,
  year: number
): Promise<VehicleSpecs | null> => {
  const cacheKey = createCacheKey(make, model, year);
  
  // 0. Check cache first (fastest)
  const cachedSpecs = getFromCache(cacheKey);
  if (cachedSpecs) {
    console.log('⚡ Specs found in cache (instant)');
    return cachedSpecs;
  }
  
  console.log('🔍 Fetching vehicle specs for:', { make, model, year });
  
  // 1. Try local Indian vehicle database (fast, no API call)
  const localSpecs = fetchSpecsFromLocalDB(make, model);
  if (localSpecs) {
    console.log('✅ Specs found in local DB');
    addToCache(cacheKey, localSpecs, 'local');
    return localSpecs;
  }
  
  // 2. Try CarQuery API for international vehicles
  try {
    const apiSpecs = await fetchVehicleSpecsFromCarQuery(make, model, year);
    if (apiSpecs && apiSpecs.engine) {
      console.log('✅ Specs found via CarQuery API');
      addToCache(cacheKey, apiSpecs, 'api');
      return apiSpecs;
    }
  } catch (error) {
    console.log('CarQuery API failed, will return null for Gemini fallback');
  }
  
  // 3. Return null - caller should fall back to Gemini AI
  console.log('⚠️ No specs found in local DB or CarQuery, returning null');
  return null;
};

/**
 * Add specs from AI to cache (called by parent component after AI lookup)
 */
export const cacheAISpecs = (
  make: string,
  model: string,
  year: number,
  specs: VehicleSpecs
): void => {
  const cacheKey = createCacheKey(make, model, year);
  addToCache(cacheKey, specs, 'ai');
  console.log('💾 Cached AI-generated specs for:', cacheKey);
};

/**
 * Prefetch specs for common vehicles (call on app init for better UX)
 */
export const prefetchCommonVehicleSpecs = async (): Promise<void> => {
  const commonVehicles = [
    { make: 'Maruti Suzuki', model: 'Swift', year: 2023 },
    { make: 'Maruti Suzuki', model: 'Baleno', year: 2023 },
    { make: 'Hyundai', model: 'Creta', year: 2023 },
    { make: 'Hyundai', model: 'i20', year: 2023 },
    { make: 'Tata', model: 'Nexon', year: 2023 },
    { make: 'Tata', model: 'Punch', year: 2023 },
    { make: 'Mahindra', model: 'XUV700', year: 2023 },
    { make: 'Kia', model: 'Seltos', year: 2023 },
  ];
  
  console.log('📥 Prefetching specs for common vehicles...');
  
  for (const vehicle of commonVehicles) {
    await fetchVehicleSpecs(vehicle.make, vehicle.model, vehicle.year);
  }
  
  console.log('✅ Prefetch complete');
};
