/**
 * Reverse geocode proxy — Nominatim from the server avoids WebView fetch quirks on mobile.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supportEmail } from '../../constants/legalContact.js';

function firstQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function handleGeocode(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

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
      headers: {
        'User-Agent': 'ReRide-App/1.0 (https://www.reride.co.in)',
        Accept: 'application/json',
        'Accept-Language': 'en,en-IN,en-GB',
      },
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
