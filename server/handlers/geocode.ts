/**
 * Geocode proxy — Nominatim from the server avoids WebView fetch quirks on mobile.
 * Supports both reverse geocoding (coords → address) and forward search (query → locations).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supportEmail } from '../../constants/legalContact.js';

const NOMINATIM_HEADERS = {
  'User-Agent': 'ReRide-App/1.0 (https://www.reride.co.in)',
  Accept: 'application/json',
  'Accept-Language': 'en,en-IN,en-GB',
};

function firstQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function handleReverseGeocode(req: VercelRequest, res: VercelResponse) {
  const lat = parseFloat(firstQueryParam(req.query.lat) ?? '');
  const lon = parseFloat(firstQueryParam(req.query.lon) ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ success: false, reason: 'Invalid coordinates' });
  }

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json` +
    `&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lon))}` +
    `&zoom=14&addressdetails=1&accept-language=en` +
    `&email=${encodeURIComponent(supportEmail)}`;

  try {
    const upstream = await fetch(url, {
      headers: NOMINATIM_HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(502).json({ success: false, reason: 'Geocoding upstream failed' });
    }

    const data = (await upstream.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };

    return res.status(200).json({
      success: true,
      address: data.address ?? {},
      displayName: data.display_name ?? '',
    });
  } catch {
    return res.status(502).json({ success: false, reason: 'Geocoding failed' });
  }
}

async function handleForwardSearch(req: VercelRequest, res: VercelResponse) {
  const q = (firstQueryParam(req.query.q) ?? '').trim();
  if (!q || q.length < 2) {
    return res.status(400).json({ success: false, reason: 'Query too short' });
  }

  const limit = Math.min(parseInt(firstQueryParam(req.query.limit) ?? '8', 10) || 8, 15);
  const countryCode = firstQueryParam(req.query.country) ?? 'in';

  const url =
    `https://nominatim.openstreetmap.org/search?format=json` +
    `&q=${encodeURIComponent(q)}` +
    `&countrycodes=${encodeURIComponent(countryCode)}` +
    `&limit=${limit}` +
    `&addressdetails=1&accept-language=en` +
    `&email=${encodeURIComponent(supportEmail)}`;

  try {
    const upstream = await fetch(url, {
      headers: NOMINATIM_HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(502).json({ success: false, reason: 'Search upstream failed' });
    }

    type NominatimResult = {
      place_id: number;
      lat: string;
      lon: string;
      display_name: string;
      type: string;
      class: string;
      address?: Record<string, string>;
      importance: number;
    };

    const results = (await upstream.json()) as NominatimResult[];

    const locations = results.map((r) => {
      const addr = r.address ?? {};
      const city =
        addr.city || addr.town || addr.municipality || addr.village ||
        addr.city_district || addr.suburb || addr.county || '';
      const state = addr.state || addr.state_district || '';
      const district = addr.state_district || addr.county || '';

      return {
        placeId: r.place_id,
        displayName: r.display_name,
        city,
        state,
        district,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        type: r.type,
        importance: r.importance,
      };
    });

    return res.status(200).json({ success: true, results: locations });
  } catch {
    return res.status(502).json({ success: false, reason: 'Search failed' });
  }
}

export async function handleGeocode(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  const pathname = (req.url ?? '').split('?')[0];

  if (pathname.includes('/search')) {
    return handleForwardSearch(req, res);
  }

  return handleReverseGeocode(req, res);
}
