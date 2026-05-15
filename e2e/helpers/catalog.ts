import type { APIRequestContext } from '@playwright/test';
import type { Vehicle } from '../../types';

const API_BASE = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';

/** Fetch published vehicles from the dev API (Supabase-backed when configured). */
export async function fetchPublishedVehicles(
  request: APIRequestContext,
): Promise<Vehicle[]> {
  const res = await request.get(`${API_BASE}/api/vehicles`);
  if (!res.ok()) {
    throw new Error(`GET /api/vehicles failed: ${res.status()}`);
  }
  const body = (await res.json()) as Vehicle[] | { vehicles?: Vehicle[] };
  const list = Array.isArray(body) ? body : (body.vehicles ?? []);
  return list.filter((v) => v?.status === 'published');
}

export async function fetchSoldVehicle(
  request: APIRequestContext,
): Promise<Vehicle | null> {
  const res = await request.get(`${API_BASE}/api/vehicles`);
  if (!res.ok()) return null;
  const body = (await res.json()) as Vehicle[];
  const list = Array.isArray(body) ? body : [];
  return list.find((v) => v?.status === 'sold') ?? null;
}
