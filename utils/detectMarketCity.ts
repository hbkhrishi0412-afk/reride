import { CITY_COORDINATES, CITIES_BY_STATE, INDIAN_STATES } from '../constants/location.js';
import { HOME_DISCOVERY_CITY_ORDER } from '../constants/homeDiscovery.js';
import { calculateDistance } from '../services/locationService.js';
import { CITY_MAPPING, getCityNamesForDisplay, getDisplayNameForCity, primaryLocationLabel } from './cityMapping.js';
import { getCurrentPositionUnified } from './getCurrentPositionUnified.js';
import {
  fetchReverseGeocodeAddress,
  resolveDisplayLocationFromAddress,
} from './reverseGeocode.js';

export type DetectedMarketCity = {
  /** Display name from HOME_DISCOVERY / CITY_MAPPING (e.g. "Delhi NCR", "Mumbai"). */
  city: string;
  /** Header-friendly label, often "City, State". */
  locationLabel: string;
  lat: number;
  lng: number;
};

function formatCityAndState(cityCanonical: string, stateCode: string): string {
  const displayCity = getDisplayNameForCity(cityCanonical);
  const stateName = INDIAN_STATES.find((s) => s.code === stateCode)?.name;
  return stateName ? `${displayCity}, ${stateName}` : displayCity;
}

function nearestCatalogCityName(lat: number, lng: number): string {
  let bestName = 'Mumbai';
  let bestD = Infinity;
  for (const [name, c] of Object.entries(CITY_COORDINATES)) {
    const d = calculateDistance({ lat, lng }, { lat: c.lat, lng: c.lng });
    if (d < bestD) {
      bestD = d;
      bestName = name;
    }
  }
  return bestName;
}

/** Map a catalog / geocode city name to a home-discovery display city. */
export function toHomeDiscoveryCityName(catalogName: string): string {
  const lower = catalogName.toLowerCase().trim();
  for (const displayName of HOME_DISCOVERY_CITY_ORDER) {
    if (displayName.toLowerCase() === lower) return displayName;
    const aliases = CITY_MAPPING[displayName] ?? [];
    if (aliases.some((a) => a.toLowerCase() === lower)) return displayName;
    if (getCityNamesForDisplay(displayName).some((a) => a.toLowerCase() === lower)) {
      return displayName;
    }
  }
  return getDisplayNameForCity(catalogName);
}

function locationLabelForCity(displayCity: string): string {
  const allRows = Object.entries(CITIES_BY_STATE).flatMap(([stateCode, cities]) =>
    cities.map((city) => ({ city, stateCode })),
  );
  const canon = allRows.find(
    (r) =>
      getDisplayNameForCity(r.city).toLowerCase() === displayCity.toLowerCase() ||
      r.city.toLowerCase() === displayCity.toLowerCase(),
  );
  if (canon) return formatCityAndState(canon.city, canon.stateCode);
  return displayCity;
}

const ALL_CITY_ROWS = Object.entries(CITIES_BY_STATE).flatMap(([stateCode, cities]) =>
  cities.map((city) => ({ city, stateCode })),
);

/** Browser / Capacitor geolocation → market city (same reverse-geocode path as LocationModal). */
export async function detectNearestMarketCity(): Promise<DetectedMarketCity | null> {
  try {
    const position = await getCurrentPositionUnified();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    let locationLabel = locationLabelForCity(toHomeDiscoveryCityName(nearestCatalogCityName(lat, lng)));
    try {
      const address = await fetchReverseGeocodeAddress(lat, lng);
      locationLabel = resolveDisplayLocationFromAddress(
        address,
        ALL_CITY_ROWS,
        INDIAN_STATES,
        lat,
        lng,
      );
    } catch {
      /* nearest-catalog fallback already set */
    }

    const city = toHomeDiscoveryCityName(primaryLocationLabel(locationLabel));
    return {
      city,
      locationLabel,
      lat,
      lng,
    };
  } catch {
    return null;
  }
}
