import type {
  LocationCoordinates,
  NearbyLandmark,
  PopularSearch,
  CityStats,
  RadiusSearchParams,
  Vehicle,
} from '../types.js';

// ============================================
// DISTANCE CALCULATIONS
// ============================================

// Haversine formula to calculate distance between two coordinates (in km)
export function calculateDistance(
  point1: LocationCoordinates,
  point2: LocationCoordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) *
    Math.cos(toRadians(point2.lat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================
// USER LOCATION
// ============================================

/** Capacitor-native permission flow + timeouts (shared with LocationModal). */
export async function getUserLocation(): Promise<LocationCoordinates | null> {
  try {
    const { getCurrentPositionUnified } = await import('../utils/getCurrentPositionUnified.js');
    const position = await getCurrentPositionUnified();
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    console.error('Geolocation error:', error);
    return null;
  }
}

// Get city coordinates
export async function getCityCoordinates(city: string): Promise<LocationCoordinates | null> {
  const { CITY_COORDINATES } = await import('../constants');
  return CITY_COORDINATES[city] || null;
}

// ============================================
// LANDMARKS
// ============================================

// Find nearby landmarks within a radius
export async function findNearbyLandmarks(
  userLocation: LocationCoordinates,
  radiusKm: number = 10,
  city?: string
): Promise<Array<NearbyLandmark & { distance: number }>> {
  const { INDIAN_LANDMARKS } = await import('../constants');
  let landmarks = INDIAN_LANDMARKS;
  
  if (city) {
    landmarks = landmarks.filter(l => l.city === city);
  }
  
  return landmarks
    .map(landmark => ({
      ...landmark,
      distance: calculateDistance(userLocation, landmark.location),
    }))
    .filter(landmark => landmark.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

// ============================================
// RADIUS SEARCH
// ============================================

// Filter vehicles by radius
export function filterVehiclesByRadius(
  vehicles: Vehicle[],
  params: RadiusSearchParams
): Vehicle[] {
  return vehicles
    .filter(vehicle => {
      // Skip if vehicle doesn't have location
      if (!vehicle.exactLocation) return false;
      
      const distance = calculateDistance(params.center, vehicle.exactLocation);
      
      // Check radius
      if (distance > params.radiusKm) return false;
      
      // Apply additional filters if provided
      if (params.filters) {
        if (params.filters.make && vehicle.make !== params.filters.make) return false;
        if (params.filters.model && vehicle.model !== params.filters.model) return false;
        if (params.filters.minPrice && vehicle.price < params.filters.minPrice) return false;
        if (params.filters.maxPrice && vehicle.price > params.filters.maxPrice) return false;
        if (params.filters.features && params.filters.features.length > 0) {
          if (!params.filters.features.every(f => vehicle.features.includes(f))) return false;
        }
      }
      
      return true;
    })
    .map(vehicle => ({
      ...vehicle,
      distanceFromUser: calculateDistance(params.center, vehicle.exactLocation!),
    }))
    .sort((a, b) => (a.distanceFromUser || 0) - (b.distanceFromUser || 0));
}

// ============================================
// CITY STATS
// ============================================

// Get popular searches for a city
export async function getPopularSearchesByCity(city: string): Promise<PopularSearch[]> {
  const { POPULAR_SEARCHES_BY_CITY } = await import('../constants');
  return POPULAR_SEARCHES_BY_CITY[city] || [];
}

// Get city statistics
export function getCityStats(vehicles: Vehicle[], city: string): CityStats | null {
  const cityVehicles = vehicles.filter(v => v.city === city && v.status === 'published');
  
  if (cityVehicles.length === 0) return null;
  
  const totalPrice = cityVehicles.reduce((sum, v) => sum + v.price, 0);
  const averagePrice = Math.round(totalPrice / cityVehicles.length);
  
  // Get popular makes
  const makeCount: Record<string, number> = {};
  cityVehicles.forEach(v => {
    makeCount[v.make] = (makeCount[v.make] || 0) + 1;
  });
  const popularMakes = Object.entries(makeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([make]) => make);
  
  // Get popular categories
  const categoryCount: Record<string, number> = {};
  cityVehicles.forEach(v => {
    categoryCount[v.category] = (categoryCount[v.category] || 0) + 1;
  });
  const popularCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category as any);
  
  const stateCode = cityVehicles[0]?.state || '';
  
  return {
    cityName: city,
    stateCode,
    totalListings: cityVehicles.length,
    averagePrice,
    popularMakes,
    popularCategories,
  };
}

// ============================================
// SEARCH TRACKING
// ============================================

const SEARCH_HISTORY_KEY = 'reride_search_history';

// Track popular searches
export function trackSearch(query: string, city?: string, state?: string): void {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    const searches: PopularSearch[] = stored ? JSON.parse(stored) : [];
    
    const existing = searches.find(
      s => s.query.toLowerCase() === query.toLowerCase() && s.city === city
    );
    
    if (existing) {
      existing.count += 1;
    } else {
      searches.push({
        id: Date.now(),
        query,
        count: 1,
        city,
        state,
        createdAt: new Date().toISOString(),
      });
    }
    
    // Keep only top 100 searches
    searches.sort((a, b) => b.count - a.count);
    const topSearches = searches.slice(0, 100);
    
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(topSearches));
  } catch (error) {
    console.error('Error tracking search:', error);
  }
}

// Get recent searches
export function getRecentSearches(limit: number = 5): PopularSearch[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    
    const searches: PopularSearch[] = JSON.parse(stored);
    return searches.slice(0, limit);
  } catch (error) {
    console.error('Error getting recent searches:', error);
    return [];
  }
}

// Clear search history
export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing search history:', error);
  }
}

// ============================================
// SAVED LOCATIONS (Future Enhancement)
// ============================================

// These can be added later for user saved locations
// export function saveUserLocation(...)
// export function getSavedLocations(...)

