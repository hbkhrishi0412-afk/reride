/**
 * Canonical vehicle identity helpers.
 * Supabase `vehicles.id` is TEXT (numeric string or UUID). The app also exposes a
 * numeric `Vehicle.id` (parsed number or deterministic hash for UUID rows).
 */

import type { Vehicle } from '../types.js';

export const VEHICLE_LIST_CACHE_VERSION = 5;
export const VEHICLE_LIST_CACHE_VERSION_KEY = 'reRideVehicleListSchemaVersion';

export const SAFE_VEHICLE_ID_MULTIPLIER = 1000;

let vehicleIdFallbackSeq = 0;

/**
 * Collision-resistant numeric id that stays within Number.MAX_SAFE_INTEGER.
 * Uses ms timestamp × 1000 + random(0–999) → up to 1000 listings/ms (~2255 safe ceiling).
 */
export function generateSafeVehicleNumericId(): number {
  let randomSuffix: number;
  try {
    const buf = new Uint8Array(2);
    globalThis.crypto.getRandomValues(buf);
    randomSuffix = ((buf[0] << 8) | buf[1]) % SAFE_VEHICLE_ID_MULTIPLIER;
  } catch {
    randomSuffix = vehicleIdFallbackSeq++ % SAFE_VEHICLE_ID_MULTIPLIER;
  }
  const id = Date.now() * SAFE_VEHICLE_ID_MULTIPLIER + randomSuffix;
  if (!Number.isSafeInteger(id)) {
    return Date.now() + randomSuffix;
  }
  return id;
}

/** True when a numeric id exceeds IEEE-754 safe integer range. */
export function isUnsafeVehicleNumericId(id: unknown): boolean {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 && !Number.isSafeInteger(n);
}

/** Parse a digit-only id string without losing precision. */
function parseDigitIdString(raw: string): { numericId?: number; databaseId?: string } {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return {};
  const parsed = Number(trimmed);
  const numericId = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  const needsStringPk =
    trimmed.length > 15 || (numericId != null && !Number.isSafeInteger(numericId));
  return {
    numericId,
    databaseId: needsStringPk ? trimmed : undefined,
  };
}

export const MUTATION_IDENTITY_REFRESH_MESSAGE =
  'Listing identity is outdated. Refresh your listings and try again.';

export class VehicleMutationIdentityError extends Error {
  constructor(message: string = MUTATION_IDENTITY_REFRESH_MESSAGE) {
    super(message);
    this.name = 'VehicleMutationIdentityError';
  }
}

export interface ParsedVehicleIdentityInput {
  id?: unknown;
  vehicleId?: unknown;
  databaseId?: unknown;
}

export interface ParsedVehicleIdentity {
  numericId?: number;
  databaseId: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidPrimaryKey(pk: string): boolean {
  return UUID_RE.test(String(pk || '').trim());
}

/** Parse listing ids from API / dashboard request bodies. */
export function parseVehicleIdentityFromBody(body: ParsedVehicleIdentityInput): ParsedVehicleIdentity {
  let databaseId =
    typeof body.databaseId === 'string' && body.databaseId.trim() !== ''
      ? body.databaseId.trim()
      : '';

  const raw = body.vehicleId ?? body.id;
  let numericId: number | undefined;
  if (raw !== undefined && raw !== null && raw !== '') {
    if (typeof raw === 'string') {
      const digitParsed = parseDigitIdString(raw);
      if (digitParsed.numericId != null) {
        numericId = digitParsed.numericId;
        if (!databaseId && digitParsed.databaseId) {
          databaseId = digitParsed.databaseId;
        }
      }
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        numericId = parsed;
        if (!databaseId && !Number.isSafeInteger(parsed)) {
          databaseId = String(parsed);
        }
      }
    }
  }

  return { numericId, databaseId };
}

/** Deterministic 53-bit hash for non-numeric TEXT ids (must match supabase-vehicle-service). */
export function stringToNumericVehicleId(s: string): number {
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  const hi = (h2 ^ (h1 >>> 16)) >>> 0;
  const lo = (h1 ^ (h2 >>> 16)) >>> 0;
  return (hi % 0x1fffff) * 0x100000000 + lo;
}

export function hasResolvableVehicleIdentity(parsed: ParsedVehicleIdentity): boolean {
  return Boolean(parsed.databaseId) || parsed.numericId !== undefined;
}

/** True when a row uses a hashed client id (UUID primary key in Supabase). */
export function isHashedClientId(vehicle: { id: number; databaseId?: string }): boolean {
  const pk = vehicle.databaseId?.trim();
  if (!pk) return false;
  if (isUuidPrimaryKey(pk)) return true;
  if (String(vehicle.id) === pk) return false;
  return stringToNumericVehicleId(pk) === vehicle.id;
}

/**
 * Trim and preserve `databaseId` from API responses.
 * Never infer primary keys from numeric `id` alone (hashed UUID ids look like large numbers).
 */
export function normalizeVehicleIdentity<T extends Pick<Vehicle, 'id' | 'databaseId'>>(vehicle: T): T {
  if (!vehicle || vehicle.id == null) return vehicle;

  const trimmed = vehicle.databaseId?.trim();
  if (trimmed) {
    return trimmed === vehicle.databaseId ? vehicle : { ...vehicle, databaseId: trimmed };
  }

  if (isUnsafeVehicleNumericId(vehicle.id)) {
    const decimal = String(Number(vehicle.id));
    if (/^\d+$/.test(decimal)) {
      return { ...vehicle, databaseId: decimal };
    }
  }

  return vehicle;
}

export function normalizeVehiclesList<T extends Pick<Vehicle, 'id' | 'databaseId'>>(vehicles: T[]): T[] {
  if (!Array.isArray(vehicles)) return [];
  return vehicles.map((v) => normalizeVehicleIdentity(v));
}

/** Find a listing in client state by canonical primary key or numeric id (handles unsafe integers). */
export function findVehicleByIdentity<T extends Pick<Vehicle, 'id' | 'databaseId'>>(
  vehicles: ReadonlyArray<T> | null | undefined,
  id: number,
  databaseId?: string,
): T | undefined {
  if (!Array.isArray(vehicles)) return undefined;
  const pk = databaseId?.trim();
  if (pk) {
    const byPk = vehicles.find((v) => v && getCanonicalPrimaryKey(v) === pk);
    if (byPk) return byPk;
  }
  return vehicles.find((v) => v && vehicleIdsEqual(v.id, id));
}

export function getCanonicalPrimaryKey(vehicle: Pick<Vehicle, 'id' | 'databaseId'>): string | null {
  const normalized = normalizeVehicleIdentity(vehicle);
  const pk = normalized.databaseId?.trim();
  if (pk) return pk;

  // Large numeric Supabase TEXT primary keys (e.g. Date.now()-based ids) exceed
  // MAX_SAFE_INTEGER. Stale client rows often keep the rounded `id` but drop
  // `databaseId`; the decimal string still matches `vehicles.id` in Supabase.
  const idNum = Number(normalized.id);
  if (Number.isFinite(idNum) && idNum > 0 && !Number.isSafeInteger(idNum)) {
    const decimal = String(idNum);
    if (/^\d+$/.test(decimal)) return decimal;
  }

  return null;
}

export function canMutateVehicle(vehicle: Pick<Vehicle, 'id' | 'databaseId'>): boolean {
  return getCanonicalPrimaryKey(vehicle) != null;
}

export function vehicleMissingCanonicalId(vehicle: Pick<Vehicle, 'id' | 'databaseId'>): boolean {
  return !canMutateVehicle(vehicle);
}

/** Drop legacy vehicle list caches that predate mandatory `databaseId`. */
export function migrateVehicleListCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = localStorage.getItem(VEHICLE_LIST_CACHE_VERSION_KEY);
    if (current === String(VEHICLE_LIST_CACHE_VERSION)) return;
    localStorage.removeItem('reRideVehicles_prod');
    localStorage.removeItem('reRideVehicles');
    localStorage.setItem(VEHICLE_LIST_CACHE_VERSION_KEY, String(VEHICLE_LIST_CACHE_VERSION));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Client-side POST/PUT body — throws if canonical id cannot be determined. */
export function buildVehicleMutationBody(
  vehicleId: number,
  vehicles: ReadonlyArray<Pick<Vehicle, 'id' | 'databaseId'>>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const vehicle = vehicles.find((v) => v && vehicleIdsEqual(v.id, vehicleId))
    ?? findVehicleByIdentity(vehicles, vehicleId);
  if (!vehicle) {
    throw new VehicleMutationIdentityError('Listing not found in your session. Refresh and try again.');
  }

  const databaseId = getCanonicalPrimaryKey(vehicle);
  if (!databaseId) {
    throw new VehicleMutationIdentityError();
  }

  const payload: Record<string, unknown> = {
    databaseId,
    ...extra,
  };
  if (Number.isSafeInteger(vehicle.id)) {
    payload.vehicleId = vehicleId;
  } else {
    payload.vehicleId = databaseId;
  }
  return payload;
}

export function assertVehicleMutationPayload(
  vehicle: Pick<Vehicle, 'id' | 'databaseId'>,
): asserts vehicle is Vehicle & { databaseId: string } {
  const databaseId = getCanonicalPrimaryKey(vehicle);
  if (!databaseId) {
    throw new VehicleMutationIdentityError();
  }
}

/** Canonical URL segment — prefer Supabase TEXT primary key over hashed numeric id. */
export function getVehicleRouteId(vehicle: Pick<Vehicle, 'id' | 'databaseId'>): string {
  const pk = getCanonicalPrimaryKey(vehicle);
  if (pk) return encodeURIComponent(pk);
  return encodeURIComponent(String(vehicle.id));
}

export interface ResolvedRouteVehicleId {
  routeSegment: string;
  databaseId?: string;
  numericId?: number;
}

export function resolveVehicleIdFromRouteSegment(segment: string): ResolvedRouteVehicleId {
  const decoded = decodeURIComponent((segment || '').trim());
  if (!decoded) return { routeSegment: '' };
  if (isUuidPrimaryKey(decoded)) {
    return { routeSegment: decoded, databaseId: decoded };
  }
  if (/^\d+$/.test(decoded)) {
    const n = parseInt(decoded, 10);
    if (Number.isFinite(n)) {
      return { routeSegment: decoded, numericId: n, databaseId: decoded };
    }
  }
  return { routeSegment: decoded, databaseId: decoded };
}

export function vehicleIdsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export function vehicleMatchesRouteSegment(
  vehicle: Pick<Vehicle, 'id' | 'databaseId'>,
  segment: string,
): boolean {
  const resolved = resolveVehicleIdFromRouteSegment(segment);
  const pk = getCanonicalPrimaryKey(vehicle);
  if (resolved.databaseId && pk && pk === resolved.databaseId) return true;
  if (resolved.numericId != null && vehicleIdsEqual(vehicle.id, resolved.numericId)) return true;
  return false;
}

export function findVehicleByRouteSegment<T extends Pick<Vehicle, 'id' | 'databaseId'>>(
  vehicles: T[],
  segment: string,
): T | undefined {
  const resolved = resolveVehicleIdFromRouteSegment(segment);
  if (resolved.databaseId) {
    const byPk = vehicles.find((v) => getCanonicalPrimaryKey(v) === resolved.databaseId);
    if (byPk) return byPk;
  }
  if (resolved.numericId != null) {
    return vehicles.find((v) => vehicleIdsEqual(v.id, resolved.numericId));
  }
  return undefined;
}

/** Reject inline base64 blobs in listing image/document arrays — must be storage URLs. */
export function sanitizeVehicleMediaUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u): u is string => typeof u === 'string' && u.trim() !== '')
    .map((u) => u.trim())
    .filter((u) => !u.startsWith('data:'));
}
