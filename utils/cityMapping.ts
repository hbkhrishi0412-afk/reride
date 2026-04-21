/**
 * City mapping utility to map display names to actual city names in vehicle data
 * This handles cases where display names (e.g., "Delhi NCR") differ from 
 * actual city names stored in vehicle data (e.g., "Delhi", "New Delhi")
 */

import { INDIAN_STATES } from '../constants/location';

export interface CityMapping {
  displayName: string;
  actualNames: string[]; // All possible city names that should match
}

/**
 * Mapping of display city names to actual city names in vehicle data
 */
export const CITY_MAPPING: Record<string, string[]> = {
  'Delhi NCR': ['Delhi', 'New Delhi', 'Delhi NCR', 'NCR'],
  'Mumbai': ['Mumbai', 'Bombay'],
  'Bangalore': ['Bangalore', 'Bengaluru'],
  'Pune': ['Pune'],
  'Hyderabad': ['Hyderabad'],
};

/** First segment before comma — header location may be stored as "City, State". */
export function primaryLocationLabel(value: string): string {
  return (value || '').split(',')[0].trim();
}

/**
 * Get all possible city names for a given display name
 * @param displayName - The display name (e.g., "Delhi NCR")
 * @returns Array of actual city names that should match
 */
export function getCityNamesForDisplay(displayName: string): string[] {
  const primary = primaryLocationLabel(displayName);
  if (!primary) return [];
  return CITY_MAPPING[primary] || CITY_MAPPING[displayName] || [primary];
}

/**
 * Check if a vehicle city matches a display city name
 * @param vehicleCity - The city name from vehicle data
 * @param displayCity - The display city name (e.g., "Delhi NCR")
 * @returns true if the vehicle city matches the display city
 */
export function matchesCity(vehicleCity: string | undefined, displayCity: string | undefined): boolean {
  if (!displayCity) return true; // No filter selected
  if (!vehicleCity) return false; // Vehicle has no city

  // Normalize both strings for comparison. Many vehicle cities include state codes
  // like "Hyderabad, TS" – strip anything after the comma. Header may use "City, State".
  const normalize = (city: string) => city.split(',')[0].trim().toLowerCase();
  const normalizedVehicleCity = normalize(vehicleCity);
  const normalizedDisplayCity = normalize(displayCity);

  // Get all possible city names for the display name
  const possibleNames = getCityNamesForDisplay(displayCity).map(normalize);

  // Check for exact or starts-with/contains matches to be forgiving
  return (
    possibleNames.some((name) => name === normalizedVehicleCity) ||
    normalizedVehicleCity === normalizedDisplayCity ||
    possibleNames.some((name) => normalizedVehicleCity.includes(name) || name.includes(normalizedVehicleCity))
  );
}

/**
 * Get the display name for a given city name
 * Useful for showing the correct display name when a vehicle city is known
 */
export function getDisplayNameForCity(cityName: string): string {
  const primary = primaryLocationLabel(cityName);
  const lookUp = primary || cityName;
  for (const [displayName, actualNames] of Object.entries(CITY_MAPPING)) {
    if (actualNames.some(name => name.toLowerCase() === lookUp.toLowerCase())) {
      return displayName;
    }
  }
  return lookUp || cityName;
}

/**
 * Get state code for a given city name
 * Uses CITIES_BY_STATE mapping to find which state a city belongs to
 */
export function getStateCodeForCity(cityName: string, citiesByState: Record<string, string[]>): string | null {
  if (!cityName) return null;
  
  const normalizedCity = cityName.trim().toLowerCase();
  
  // First, check if it's a display name and get actual city names
  const possibleNames = getCityNamesForDisplay(cityName);
  
  // Search through all states to find which state contains this city
  for (const [stateCode, cities] of Object.entries(citiesByState)) {
    for (const city of cities) {
      // Check if any of the possible city names match
      if (possibleNames.some(name => 
        name.trim().toLowerCase() === city.trim().toLowerCase()
      ) || city.trim().toLowerCase() === normalizedCity) {
        return stateCode;
      }
    }
  }
  
  return null;
}

/**
 * Canonical English label for persisted header / filter location.
 * Keeps vehicle matching reliable (listings use Latin city names) and dedupes aliases.
 */
export function normalizeUserLocationForStorage(raw: string): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  if (/^all of india$/i.test(t)) return 'All of India';

  const stateOnly = INDIAN_STATES.find((s) => s.name.toLowerCase() === t.toLowerCase());
  if (stateOnly) return stateOnly.name;

  const comma = t.indexOf(',');
  if (comma !== -1) {
    const cityPart = t.slice(0, comma).trim();
    const tail = t.slice(comma + 1).trim();
    const cityNorm = getDisplayNameForCity(primaryLocationLabel(cityPart)) || cityPart;
    const stateName = INDIAN_STATES.find((s) => s.name.toLowerCase() === tail.toLowerCase())?.name;
    if (stateName) return `${cityNorm}, ${stateName}`;
    return `${cityNorm}, ${tail}`;
  }

  return getDisplayNameForCity(primaryLocationLabel(t)) || t;
}
