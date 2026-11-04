import type { User } from '../types.js';
import { authenticatedFetch, handleApiResponse } from './authenticatedFetch.js';
import { currentUserForLocalSessionJson } from './userLocalStorageSnapshot.js';

/** Plan fields admin can change that the seller dashboard must pick up. */
export const SELLER_PLAN_SYNC_KEYS = [
  'subscriptionPlan',
  'planActivatedDate',
  'planExpiryDate',
  'featuredCredits',
  'usedCertifications',
] as const;

type SellerPlanSyncKey = (typeof SELLER_PLAN_SYNC_KEYS)[number];

export function sellerPlanFieldsChanged(
  prev: Pick<User, SellerPlanSyncKey> | null | undefined,
  next: Pick<User, SellerPlanSyncKey> | null | undefined,
): boolean {
  if (!prev || !next) return Boolean(next);
  return SELLER_PLAN_SYNC_KEYS.some((key) => prev[key] !== next[key]);
}

export function mergeSellerPlanFields(prev: User, next: Partial<User>): User {
  const merged: User = { ...prev };
  for (const key of SELLER_PLAN_SYNC_KEYS) {
    if (next[key] !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = next[key];
    }
  }
  return merged;
}

/** Persist + notify so AppProvider / dashboards adopt admin plan changes without reload. */
export function publishCurrentUserPlanUpdate(user: User): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(user));
    sessionStorage.setItem('currentUser', currentUserForLocalSessionJson(user));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent('userDataUpdated', { detail: { user } }));
}

/** Fetch the authenticated seller's own profile (includes plan fields). */
export async function fetchOwnSellerProfile(email: string): Promise<User | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;
  try {
    const response = await authenticatedFetch(
      `/api/users?email=${encodeURIComponent(normalized)}`,
    );
    if (!response.ok) return null;
    const parsed = await handleApiResponse<User | User[]>(response);
    if (!parsed.success) return null;
    const data = parsed.data;
    if (Array.isArray(data)) {
      return (
        data.find((u) => u?.email?.toLowerCase().trim() === normalized) ?? null
      );
    }
    if (data && typeof data === 'object' && 'email' in data) {
      return data as User;
    }
    return null;
  } catch {
    return null;
  }
}
