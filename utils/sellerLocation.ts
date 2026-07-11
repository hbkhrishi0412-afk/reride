import type { User } from '../types.js';
import { getCityCoordinates } from '../services/locationService.js';
import { CITY_COORDINATES } from '../constants/location.js';

export type CompanyLocation = { lat: number; lng: number };

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

let lastNominatimMs = 0;
const NOMINATIM_GAP_MS = 1100;

/** Returns 6-digit pincode or empty string if invalid. */
export function normalizeIndianPincode(raw?: string | null): string {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  return d.length === 6 ? d : '';
}

/** First segment of location (city hint), lowercased. */
export function cityKeyFromLocation(loc: string | undefined): string {
  if (!loc?.trim()) return '';
  return loc.split(',')[0].trim().toLowerCase();
}

/** Group dealers by PIN when set, else by city segment. */
export function areaKeyFromSeller(seller: User): string {
  const pin = normalizeIndianPincode(seller.pincode);
  if (pin) return `pin:${pin}`;
  const city = cityKeyFromLocation(seller.location);
  return city ? `city:${city}` : '';
}

export function areaDisplayLabelFromSeller(seller: User): string {
  const pin = normalizeIndianPincode(seller.pincode);
  if (pin) return `PIN ${pin}`;
  return seller.location?.split(',')[0]?.trim() || 'This area';
}

function jitterCoords(lat: number, lng: number, seed: string): CompanyLocation {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const dx = ((h % 200) - 100) / 50000;
  const dy = (((h >> 8) % 200) - 100) / 50000;
  return { lat: lat + dx, lng: lng + dy };
}

function extractCityHint(location: string | undefined): string {
  let city = (location || '').trim();
  if (city.includes(',')) city = city.split(',')[0].trim();
  return city;
}

async function resolveCityCoordsFromLocation(location: string | undefined): Promise<CompanyLocation | null> {
  const city = extractCityHint(location);
  const cityVariations: Record<string, string> = {
    delhi: 'New Delhi',
    bangalore: 'Bengaluru',
    bengaluru: 'Bengaluru',
    calcutta: 'Kolkata',
    madras: 'Chennai',
    bombay: 'Mumbai',
  };
  const normalizedCity = cityVariations[city.toLowerCase()] || city;
  let coords: CompanyLocation | null = null;
  if (normalizedCity && CITY_COORDINATES[normalizedCity]) {
    coords = CITY_COORDINATES[normalizedCity];
  } else if (city) {
    const cityKey = Object.keys(CITY_COORDINATES).find(
      (key) => key.toLowerCase() === city.toLowerCase() || key.toLowerCase() === normalizedCity.toLowerCase()
    );
    if (cityKey) coords = CITY_COORDINATES[cityKey];
    else {
      const fetched = await getCityCoordinates(city);
      if (fetched) coords = fetched;
    }
  }
  return coords;
}

async function geocodeNominatim(params: {
  address?: string;
  pincode?: string;
  cityHint?: string;
}): Promise<CompanyLocation | null> {
  const pc = normalizeIndianPincode(params.pincode);
  const addr = (params.address || '').trim();
  const city = (params.cityHint || '').trim();
  if (!addr && !pc && !city) return null;

  const now = Date.now();
  const wait = Math.max(0, NOMINATIM_GAP_MS - (now - lastNominatimMs));
  if (wait) await sleep(wait);
  lastNominatimMs = Date.now();

  const parts = [addr, pc, city, 'India'].filter((p) => !!p);
  const q = encodeURIComponent(parts.join(', '));
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'ReRide/1.0 (dealer map; https://reride.app)',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Map pin: geocode address + PIN when possible, else city centroid + small jitter.
 * Nominatim is rate-limited; calls are spaced automatically.
 */

/** City centroid + jitter without Nominatim (fast). Returns undefined if Nominatim may be needed. */
export function tryResolveSellerCoordsFast(seller: User): CompanyLocation | null | undefined {
  const seed = seller.email || seller.id || 'unknown';
  const cityHint = extractCityHint(seller.location);
  const pc = normalizeIndianPincode(seller.pincode);
  const addr = (seller.address || '').trim();

  if (addr || pc) {
    return undefined;
  }

  let cityCoords: CompanyLocation | null = CITY_COORDINATES[cityHint] ?? null;
  if (!cityCoords && cityHint) {
    const cityKey = Object.keys(CITY_COORDINATES).find(
      (key) => key.toLowerCase() === cityHint.toLowerCase(),
    );
    if (cityKey) cityCoords = CITY_COORDINATES[cityKey];
  }
  if (cityCoords) {
    return jitterCoords(cityCoords.lat, cityCoords.lng, seed);
  }
  return undefined;
}

/** Resolve map pins for many sellers: fast city lookups first, then sequential Nominatim. */
export async function getSellerMapCoordinatesBatch(
  sellers: User[],
): Promise<Map<string, CompanyLocation | null>> {
  const out = new Map<string, CompanyLocation | null>();
  const slow: User[] = [];

  for (const seller of sellers) {
    const key = seller.email || seller.id || '';
    if (!key) continue;
    const fast = tryResolveSellerCoordsFast(seller);
    if (fast === undefined) {
      slow.push(seller);
    } else {
      out.set(key, fast);
    }
  }

  for (const seller of slow) {
    const key = seller.email || seller.id || '';
    out.set(key, await getSellerMapCoordinates(seller));
  }

  return out;
}

export async function getSellerMapCoordinates(seller: User): Promise<CompanyLocation | null> {
  const seed = seller.email || seller.id || 'unknown';
  const cityHint = extractCityHint(seller.location);
  const pc = normalizeIndianPincode(seller.pincode);
  const addr = (seller.address || '').trim();

  // Best case: full address + pincode → precise Nominatim geocode
  if (addr && pc) {
    const g = await geocodeNominatim({ address: addr, pincode: pc, cityHint });
    if (g) return jitterCoords(g.lat, g.lng, seed);
  }
  if (pc && !addr) {
    const g = await geocodeNominatim({ pincode: pc, cityHint });
    if (g) return jitterCoords(g.lat, g.lng, seed);
  }
  if (addr && !pc) {
    const g = await geocodeNominatim({ address: addr, cityHint });
    if (g) return jitterCoords(g.lat, g.lng, seed);
  }

  // Fast path: city centroid from expanded CITY_COORDINATES (90+ cities)
  const cityCoords = await resolveCityCoordsFromLocation(seller.location);
  if (cityCoords) return jitterCoords(cityCoords.lat, cityCoords.lng, seed);

  // Last resort: Nominatim geocode with just the city name from location
  if (cityHint) {
    const g = await geocodeNominatim({ cityHint });
    if (g) return jitterCoords(g.lat, g.lng, seed);
  }

  return null;
}
