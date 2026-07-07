import { CITY_COORDINATES } from '../constants/location.js';

/** Normalize a city name to a URL slug (e.g. "New Delhi" → "new-delhi"). */
export function cityNameToSlug(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Resolve a /city/:slug segment to the canonical city name used in listings.
 * Falls back to title-casing the slug when no known city matches.
 */
export function citySlugToName(slug: string): string {
  const raw = slug.trim();
  if (!raw) return '';

  const lowerSlug = raw.toLowerCase();
  for (const name of Object.keys(CITY_COORDINATES)) {
    if (cityNameToSlug(name) === lowerSlug || name.toLowerCase() === lowerSlug.replace(/-/g, ' ')) {
      return name;
    }
  }

  return raw
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** Parse city name from a path like /city/mumbai. */
export function parseCityFromPath(path: string): string | null {
  const match = path.match(/^\/city\/([^/?#]+)/i);
  if (!match) return null;
  try {
    const slug = decodeURIComponent(match[1]).trim();
    const name = citySlugToName(slug);
    return name || null;
  } catch {
    return null;
  }
}
