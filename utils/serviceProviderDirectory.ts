import { publicApiFetch } from './apiFetch.js';
import { authenticatedFetch } from './authenticatedFetch.js';

export interface ServiceProviderDirectoryEntry {
  id: string;
  name: string;
  city: string;
  state?: string;
  district?: string;
  serviceCategories?: string[];
  rating?: number;
  reviewCount?: number;
  completedJobs?: number;
  isVerified?: boolean;
}

function parseRating(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseCount(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

function mapApiProvider(raw: Record<string, unknown>): ServiceProviderDirectoryEntry | null {
  const id = String(
    raw.id || raw.firebaseUid || raw.firebase_uid || raw.uid || raw.email || '',
  ).trim();
  const name = String(raw.name || raw.dealershipName || '').trim();
  if (!id || !name) return null;
  const city = String(raw.city || raw.location || 'Unknown').trim() || 'Unknown';
  const rating = parseRating(raw.rating ?? raw.averageRating);
  const reviewCount = parseCount(raw.ratingCount);
  const metadata =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  const completedJobs = parseCount(
    raw.completedJobs ?? metadata.completedJobs ?? metadata.completedServiceCount ?? metadata.jobsCompleted,
  );
  const isVerified = Boolean(raw.isVerified);
  return {
    id,
    name,
    city,
    ...(raw.state ? { state: String(raw.state) } : {}),
    ...(raw.district ? { district: String(raw.district) } : {}),
    ...(Array.isArray(raw.serviceCategories)
      ? { serviceCategories: raw.serviceCategories as string[] }
      : {}),
    ...(rating != null ? { rating } : {}),
    ...(reviewCount != null ? { reviewCount } : {}),
    ...(completedJobs != null ? { completedJobs } : {}),
    ...(isVerified ? { isVerified: true } : {}),
  };
}

/** Admin-only full provider list from service_providers table. */
export async function fetchAdminServiceProviderDirectory(): Promise<ServiceProviderDirectoryEntry[]> {
  const resp = await authenticatedFetch('/api/service-providers?scope=all', { method: 'GET' });
  if (!resp.ok) return [];
  const data = await resp.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => mapApiProvider(row as Record<string, unknown>))
    .filter((entry): entry is ServiceProviderDirectoryEntry => entry !== null);
}

/** Public directory — no admin auth required (GET /api/users?role=service_provider). */
export async function fetchPublicServiceProviderDirectory(): Promise<ServiceProviderDirectoryEntry[]> {
  const resp = await publicApiFetch('/api/users?role=service_provider');
  if (!resp.ok) return [];
  const data = await resp.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => mapApiProvider(row as Record<string, unknown>))
    .filter((entry): entry is ServiceProviderDirectoryEntry => entry !== null);
}
