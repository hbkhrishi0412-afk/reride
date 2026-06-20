import { getSupabaseAdminClient } from '../lib/supabase-admin.js';
import { supabaseServiceProviderService } from './supabase-service-provider-service.js';

export type ProviderTrustStats = {
  rating: number | null;
  reviewCount: number;
  completedJobs: number;
};

type CompletedRequestRow = {
  provider_id?: string | null;
  metadata?: { customerReview?: { stars?: unknown } } | null;
};

/** Aggregate trust metrics from completed service_requests rows (pure — easy to test). */
export function aggregateTrustStatsFromRows(
  rows: CompletedRequestRow[],
): Record<string, ProviderTrustStats> {
  const acc: Record<
    string,
    { completedJobs: number; reviewCount: number; ratingSum: number }
  > = {};

  for (const row of rows) {
    const providerId = row.provider_id ? String(row.provider_id).trim() : '';
    if (!providerId) continue;

    if (!acc[providerId]) {
      acc[providerId] = { completedJobs: 0, reviewCount: 0, ratingSum: 0 };
    }
    acc[providerId].completedJobs += 1;

    const rawStars = row.metadata?.customerReview?.stars;
    const stars = typeof rawStars === 'number' ? rawStars : Number(rawStars);
    if (Number.isFinite(stars) && stars >= 1 && stars <= 5) {
      acc[providerId].reviewCount += 1;
      acc[providerId].ratingSum += stars;
    }
  }

  const result: Record<string, ProviderTrustStats> = {};
  for (const [providerId, bucket] of Object.entries(acc)) {
    result[providerId] = {
      completedJobs: bucket.completedJobs,
      reviewCount: bucket.reviewCount,
      rating:
        bucket.reviewCount > 0
          ? Math.round((bucket.ratingSum / bucket.reviewCount) * 10) / 10
          : null,
    };
  }
  return result;
}

/** Live trust stats for all providers with at least one completed job. */
export async function fetchAllProviderTrustStats(): Promise<Record<string, ProviderTrustStats>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('service_requests')
    .select('provider_id, metadata')
    .eq('status', 'completed')
    .not('provider_id', 'is', null);

  if (error) {
    throw new Error(`Failed to load provider trust stats: ${error.message}`);
  }

  return aggregateTrustStatsFromRows((data || []) as CompletedRequestRow[]);
}

function resolveProviderAuthId(user: Record<string, unknown>): string {
  const firebaseUid =
    (typeof user.firebaseUid === 'string' && user.firebaseUid.trim()) ||
    (typeof user.firebase_uid === 'string' && user.firebase_uid.trim()) ||
    '';
  if (firebaseUid) return firebaseUid;
  return String(user.id || user.uid || user.email || '').trim();
}

/**
 * Enrich public service-provider directory users with live trust stats from completed jobs.
 * Uses service_providers.id (auth uid) as the canonical booking id when available.
 */
export async function enrichPublicServiceProviderUsers<T extends object>(
  users: T[],
): Promise<Array<T & { rating?: number; reviewCount?: number; completedJobs?: number; isVerified?: boolean }>> {
  if (users.length === 0) return [];

  let trustByProviderId: Record<string, ProviderTrustStats> = {};
  let ratingByProviderId: Record<string, number | null> = {};
  const providerIdByEmail = new Map<string, string>();

  const providerMetaById = new Map<string, { serviceCategories?: string[]; city?: string; name?: string }>();

  try {
    const [trustStats, providerRows] = await Promise.all([
      fetchAllProviderTrustStats(),
      supabaseServiceProviderService.findAll(),
    ]);
    trustByProviderId = trustStats;
    for (const row of providerRows) {
      ratingByProviderId[row.id] = row.rating ?? null;
      if (row.email) {
        providerIdByEmail.set(String(row.email).toLowerCase().trim(), row.id);
      }
      const categories = row.serviceCategories;
      providerMetaById.set(row.id, {
        ...(Array.isArray(categories) && categories.length > 0 ? { serviceCategories: categories } : {}),
        city: row.city,
        name: row.name,
      });
    }
  } catch (err) {
    console.warn('Provider trust enrichment unavailable:', err);
  }

  return users.map((user) => {
    const raw = user as Record<string, unknown>;
    const email = typeof raw.email === 'string' ? raw.email.toLowerCase().trim() : '';
    const authId = resolveProviderAuthId(raw);
    const providerId = authId || (email ? providerIdByEmail.get(email) : '') || '';
    const stats = providerId ? trustByProviderId[providerId] : undefined;
    const columnRating = providerId ? ratingByProviderId[providerId] : null;
    const spMeta = providerId ? providerMetaById.get(providerId) : undefined;

    const rating =
      stats?.rating ??
      (columnRating != null && Number.isFinite(columnRating) ? columnRating : undefined) ??
      (typeof raw.averageRating === 'number' ? raw.averageRating : undefined) ??
      (typeof raw.rating === 'number' ? raw.rating : undefined);

    const reviewCount =
      stats?.reviewCount ??
      (typeof raw.ratingCount === 'number' ? raw.ratingCount : undefined);

    const completedJobs = stats?.completedJobs;

    return {
      ...user,
      ...(providerId ? { id: providerId } : {}),
      ...(spMeta?.name && !raw.name ? { name: spMeta.name } : {}),
      ...(spMeta?.city ? { city: spMeta.city, location: spMeta.city } : {}),
      ...(spMeta?.serviceCategories ? { serviceCategories: spMeta.serviceCategories } : {}),
      ...(rating != null && Number.isFinite(rating) ? { rating, averageRating: rating } : {}),
      ...(reviewCount != null && reviewCount > 0 ? { reviewCount } : {}),
      ...(completedJobs != null && completedJobs > 0 ? { completedJobs } : {}),
      ...(raw.isVerified ? { isVerified: true } : {}),
    };
  });
}

/** Persist aggregated trust stats onto service_providers.rating + metadata cache. */
export async function syncProviderTrustMetadata(providerId: string): Promise<ProviderTrustStats> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('service_requests')
    .select('provider_id, metadata')
    .eq('provider_id', providerId)
    .eq('status', 'completed');

  if (error) {
    throw new Error(`Failed to load requests for provider ${providerId}: ${error.message}`);
  }

  const statsMap = aggregateTrustStatsFromRows((data || []) as CompletedRequestRow[]);
  const stats: ProviderTrustStats = statsMap[providerId] ?? {
    rating: null,
    reviewCount: 0,
    completedJobs: 0,
  };

  const { data: existing, error: fetchErr } = await supabase
    .from('service_providers')
    .select('metadata')
    .eq('id', providerId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to read provider ${providerId}: ${fetchErr.message}`);
  }

  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) || {}),
    reviewCount: stats.reviewCount,
    completedJobs: stats.completedJobs,
    trustStatsSyncedAt: new Date().toISOString(),
  };

  const { error: upErr } = await supabase
    .from('service_providers')
    .update({ rating: stats.rating, metadata })
    .eq('id', providerId);

  if (upErr) {
    throw new Error(`Failed to update provider trust metadata: ${upErr.message}`);
  }

  return stats;
}

/** Backfill trust metadata for every service_providers row. */
export async function backfillAllProviderTrustMetadata(): Promise<{
  updated: number;
  providers: Array<{ id: string; stats: ProviderTrustStats }>;
}> {
  const providers = await supabaseServiceProviderService.findAll();
  const results: Array<{ id: string; stats: ProviderTrustStats }> = [];

  for (const provider of providers) {
    const stats = await syncProviderTrustMetadata(provider.id);
    results.push({ id: provider.id, stats });
  }

  return { updated: results.length, providers: results };
}
