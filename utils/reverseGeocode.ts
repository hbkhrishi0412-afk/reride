import { supportEmail } from '../constants/legalContact.js';
import { CITY_COORDINATES } from '../constants/location.js';
import { calculateDistance } from '../services/locationService.js';
import { getDisplayNameForCity } from './cityMapping.js';
import { publicApiFetch } from './apiFetch.js';

export type CityRow = { city: string; stateCode: string };
export type StateRow = { name: string; code: string };

function formatCityAndState(
  cityCanonical: string,
  stateCode: string,
  states: StateRow[],
): string {
  const displayCity = getDisplayNameForCity(cityCanonical);
  const stateName = states.find((s) => s.code === stateCode)?.name;
  return stateName ? `${displayCity}, ${stateName}` : displayCity;
}

/** Snap to nearest catalog city when geocoding is unavailable. */
export function labelFromNearestCatalogCoordinate(
  lat: number,
  lon: number,
  allCities: CityRow[],
  indianStates: StateRow[],
): string {
  let bestName = 'Mumbai';
  let bestD = Infinity;
  for (const [name, c] of Object.entries(CITY_COORDINATES)) {
    const d = calculateDistance({ lat, lng: lon }, { lat: c.lat, lng: c.lng });
    if (d < bestD) {
      bestD = d;
      bestName = name;
    }
  }
  const display = getDisplayNameForCity(bestName);
  const row = allCities.find(
    (r) => getDisplayNameForCity(r.city).toLowerCase() === display.toLowerCase(),
  );
  if (row) {
    return formatCityAndState(row.city, row.stateCode, indianStates);
  }
  return getDisplayNameForCity(bestName);
}

async function fetchNominatimDirect(lat: number, lon: number): Promise<Record<string, string>> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json` +
    `&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lon))}` +
    `&zoom=14&addressdetails=1&accept-language=en` +
    `&email=${encodeURIComponent(supportEmail)}`;

  const ac = new AbortController();
  const tid = window.setTimeout(() => ac.abort(), 6500);
  try {
    const response = await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'ReRide-App/1.0 (https://www.reride.co.in)',
        Accept: 'application/json',
        'Accept-Language': 'en,en-IN,en-GB',
      },
    });
    if (!response.ok) throw new Error('nominatim-failed');
    const data = (await response.json()) as { address?: Record<string, string> };
    return data.address ?? {};
  } finally {
    clearTimeout(tid);
  }
}

/** Server proxy first (reliable in Capacitor), then direct Nominatim as fallback. */
export async function fetchReverseGeocodeAddress(
  lat: number,
  lon: number,
): Promise<Record<string, string>> {
  try {
    const response = await publicApiFetch(
      `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      { method: 'GET' },
    );
    if (response.ok) {
      const data = (await response.json()) as { success?: boolean; address?: Record<string, string> };
      if (data.success && data.address) return data.address;
    }
  } catch {
    // fall through to direct Nominatim
  }

  if (typeof window !== 'undefined') {
    return fetchNominatimDirect(lat, lon);
  }
  return {};
}

export function resolveDisplayLocationFromAddress(
  address: Record<string, string>,
  allCities: CityRow[],
  indianStates: StateRow[],
  lat: number,
  lon: number,
): string {
  const allCitiesList = allCities.map((r) => r.city);
  const detectedCity =
    address.city ||
    address.town ||
    address.municipality ||
    address.city_district ||
    address.district ||
    address.village ||
    address.suburb ||
    address.neighbourhood ||
    address.locality ||
    address.state_district ||
    address.county;

  let matchedCity: string | null = null;
  if (detectedCity) {
    const dLower = String(detectedCity).toLowerCase();
    matchedCity =
      allCitiesList.find((city) => city.toLowerCase() === dLower) ||
      allCitiesList.find((city) => getDisplayNameForCity(city).toLowerCase() === dLower) ||
      allCitiesList.find(
        (city) =>
          city.toLowerCase().includes(dLower) ||
          dLower.includes(city.toLowerCase()) ||
          getDisplayNameForCity(city).toLowerCase().includes(dLower),
      ) ||
      null;
  }

  const row = matchedCity
    ? allCities.find(
        (c) =>
          c.city.toLowerCase() === matchedCity!.toLowerCase() ||
          getDisplayNameForCity(c.city).toLowerCase() ===
            getDisplayNameForCity(matchedCity!).toLowerCase(),
      )
    : null;

  if (row) {
    return formatCityAndState(row.city, row.stateCode, indianStates);
  }
  if (matchedCity) {
    return getDisplayNameForCity(matchedCity);
  }
  return labelFromNearestCatalogCoordinate(lat, lon, allCities, indianStates);
}
