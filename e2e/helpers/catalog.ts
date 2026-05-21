import type { APIRequestContext } from '@playwright/test';
import type { Vehicle } from '../../types';

const API_BASE = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';

async function loadVehiclesFromApi(
  request?: APIRequestContext,
): Promise<Vehicle[]> {
  const url = `${API_BASE}/api/vehicles`;
  if (request) {
    const res = await request.get(url);
    if (!res.ok()) {
      throw new Error(`GET /api/vehicles failed: ${res.status()}`);
    }
    const body = (await res.json()) as Vehicle[] | { vehicles?: Vehicle[] };
    return Array.isArray(body) ? body : (body.vehicles ?? []);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET /api/vehicles failed: ${res.status}`);
  }
  const body = (await res.json()) as Vehicle[] | { vehicles?: Vehicle[] };
  return Array.isArray(body) ? body : (body.vehicles ?? []);
}

async function markVehicleSold(
  vehicleId: number | string,
  sellerEmail: string | undefined,
  request?: APIRequestContext,
): Promise<boolean> {
  const url = `${API_BASE}/api/vehicles?action=sold`;
  const payload = { vehicleId, sellerEmail };
  if (request) {
    const res = await request.post(url, {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok();
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

/** Fetch published vehicles from the dev API (Supabase-backed when configured). */
export async function fetchPublishedVehicles(
  request: APIRequestContext,
): Promise<Vehicle[]> {
  const list = await loadVehiclesFromApi(request);
  return list.filter((v) => v?.status === 'published');
}

export async function fetchSoldVehicle(
  request?: APIRequestContext,
): Promise<Vehicle | null> {
  const list = await loadVehiclesFromApi(request);
  return list.find((v) => v?.status === 'sold') ?? null;
}

/**
 * Guarantees at least one sold listing exists for vehicle-detail E2E.
 * Marks the second published vehicle as sold via dev API (updates Supabase when configured).
 */
export async function ensureSoldVehicleForE2E(
  request?: APIRequestContext,
): Promise<Vehicle | null> {
  const existing = await fetchSoldVehicle(request);
  if (existing) return existing;

  const list = await loadVehiclesFromApi(request);
  const published = list.filter((v) => v?.status === 'published');
  if (published.length === 0) return null;

  const candidate = published.length > 1 ? published[1] : published[0];
  await markVehicleSold(candidate.id, candidate.sellerEmail, request);

  return fetchSoldVehicle(request);
}
