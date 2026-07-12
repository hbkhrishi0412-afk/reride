import { supportEmail } from '../constants/legalContact.js';
import { CITY_COORDINATES } from '../constants/location.js';
import { calculateDistance } from '../services/locationService.js';
import { getDisplayNameForCity } from './cityMapping.js';
import { publicApiFetch } from './apiFetch.js';

export type CityRow = { city: string; stateCode: string };
export type StateRow = { name: string; code: string };

export type LocationSearchResult = {
  placeId: number;
  displayName: string;
  city: string;
  state: string;
  district: string;
  lat: number;
  lon: number;
  type: string;
  importance: number;
};

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

const REVERSE_GEO_API_TIMEOUT_MS = 7000;

/** Server proxy first (reliable in Capacitor), then direct Nominatim as fallback. */
export async function fetchReverseGeocodeAddress(
  lat: number,
  lon: number,
  externalSignal?: AbortSignal,
): Promise<Record<string, string>> {
  const ac = new AbortController();
  const onExternalAbort = () => ac.abort();
  if (externalSignal) {
    if (externalSignal.aborted) ac.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const tid =
    typeof window !== 'undefined'
      ? window.setTimeout(() => ac.abort(), REVERSE_GEO_API_TIMEOUT_MS)
      : undefined;

  try {
    const response = await publicApiFetch(
      `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      { method: 'GET', signal: ac.signal },
    );
    if (response.ok) {
      const data = (await response.json()) as { success?: boolean; address?: Record<string, string> };
      if (data.success && data.address) return data.address;
    }
  } catch {
    // fall through to direct Nominatim
  } finally {
    if (tid !== undefined) window.clearTimeout(tid);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }

  if (typeof window !== 'undefined') {
    return fetchNominatimDirect(lat, lon);
  }
  return {};
}

/**
 * Forward geocode search via server proxy.
 * Returns real-time location results from Nominatim for live autocomplete.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const response = await publicApiFetch(
      `/api/geocode/search?q=${encodeURIComponent(query.trim())}&limit=8&country=in`,
      { method: 'GET', signal },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { success?: boolean; results?: LocationSearchResult[] };
    if (data.success && data.results) return data.results;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return [];
  }

  // Direct Nominatim fallback for when server proxy is unreachable
  if (typeof window !== 'undefined') {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=json` +
        `&q=${encodeURIComponent(query.trim())}` +
        `&countrycodes=in&limit=8` +
        `&addressdetails=1&accept-language=en` +
        `&email=${encodeURIComponent(supportEmail)}`;

      const resp = await fetch(url, {
        signal,
        headers: {
          'User-Agent': 'ReRide-App/1.0 (https://www.reride.co.in)',
          Accept: 'application/json',
          'Accept-Language': 'en,en-IN,en-GB',
        },
      });
      if (!resp.ok) return [];
      type NominatimResult = {
        place_id: number;
        lat: string;
        lon: string;
        display_name: string;
        type: string;
        address?: Record<string, string>;
        importance: number;
      };
      const results = (await resp.json()) as NominatimResult[];
      return results.map((r) => {
        const addr = r.address ?? {};
        return {
          placeId: r.place_id,
          displayName: r.display_name,
          city: addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.suburb || addr.county || '',
          state: addr.state || addr.state_district || '',
          district: addr.state_district || addr.county || '',
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          type: r.type,
          importance: r.importance,
        };
      });
    } catch {
      return [];
    }
  }

  return [];
}

/** Extract the best city name from a Nominatim address response, trying multiple fields. */
function extractCityFromAddress(address: Record<string, string>): string | null {
  const candidates = [
    address.city,
    address.town,
    address.municipality,
    address.city_district,
    address.village,
    address.suburb,
    address.neighbourhood,
    address.locality,
    address.district,
    address.state_district,
    address.county,
  ].filter(Boolean) as string[];

  return candidates[0] ?? null;
}

export function resolveDisplayLocationFromAddress(
  address: Record<string, string>,
  allCities: CityRow[],
  indianStates: StateRow[],
  lat: number,
  lon: number,
): string {
  const allCitiesList = allCities.map((r) => r.city);
  const detectedCity = extractCityFromAddress(address);
  const detectedState = address.state || '';

  // Try all candidate fields against the catalog, not just the first match
  const candidateNames = [
    address.city,
    address.town,
    address.municipality,
    address.city_district,
    address.village,
    address.suburb,
    address.district,
    address.state_district,
    address.county,
  ].filter(Boolean) as string[];

  let matchedCity: string | null = null;
  let matchedRow: CityRow | null = null;

  for (const candidate of candidateNames) {
    const cLower = candidate.toLowerCase().trim();

    // Exact match on canonical name
    const exact = allCitiesList.find((city) => city.toLowerCase() === cLower);
    if (exact) { matchedCity = exact; break; }

    // Exact match on display alias (e.g. Bangalore → Bengaluru)
    const byDisplay = allCitiesList.find((city) => getDisplayNameForCity(city).toLowerCase() === cLower);
    if (byDisplay) { matchedCity = byDisplay; break; }

    // Partial match: candidate contains a catalog city name or vice-versa
    const partial = allCitiesList.find(
      (city) => {
        const cl = city.toLowerCase();
        const dl = getDisplayNameForCity(city).toLowerCase();
        return cl.includes(cLower) || cLower.includes(cl) || dl.includes(cLower) || cLower.includes(dl);
      },
    );
    if (partial) { matchedCity = partial; break; }
  }

  if (matchedCity) {
    matchedRow = allCities.find(
      (c) =>
        c.city.toLowerCase() === matchedCity!.toLowerCase() ||
        getDisplayNameForCity(c.city).toLowerCase() === getDisplayNameForCity(matchedCity!).toLowerCase(),
    ) ?? null;
  }

  if (matchedRow) {
    return formatCityAndState(matchedRow.city, matchedRow.stateCode, indianStates);
  }

  // If we have a detected city and state from Nominatim but no catalog match,
  // return the raw Nominatim city + state (real-time, not limited to catalog)
  if (detectedCity && detectedState) {
    return `${detectedCity}, ${detectedState}`;
  }
  if (detectedCity) {
    return detectedCity;
  }

  return labelFromNearestCatalogCoordinate(lat, lon, allCities, indianStates);
}
