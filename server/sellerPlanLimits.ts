import { PLAN_DETAILS } from '../constants/plans.js';
import { adminReadAll } from './supabase-admin-db.js';
import type { PlanDetails, SubscriptionPlan, Vehicle } from '../types.js';
import {
  validateListingRenewal,
  validateNewListingCreation,
  type ListingRenewalValidation,
  type SellerPlanContext,
} from '../utils/listingPlanRules.js';

const PLANS_TABLE = 'plans';
const CACHE_MS = 60_000;

let plansCache: { loadedAt: number; byId: Map<string, PlanDetails> } | null = null;

const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toListingLimit = (value: unknown, fallback: number | 'unlimited'): number | 'unlimited' => {
  if (value === 'unlimited' || String(value).toLowerCase() === 'unlimited') {
    return 'unlimited';
  }
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
};

function toPlanDetails(id: string, row: Record<string, unknown>): PlanDetails {
  const basePlan = PLAN_DETAILS[id as SubscriptionPlan];
  const metadata = (row.metadata as Record<string, unknown> | undefined) || {};
  const isBasePlan = Boolean(basePlan);
  return {
    id: id as SubscriptionPlan,
    name: String(row.name || basePlan?.name || 'Custom Plan'),
    price: toNumber(row.price, basePlan?.price ?? 0),
    features: isBasePlan
      ? (basePlan?.features || [])
      : (Array.isArray(row.features) ? row.features.map(String) : []),
    listingLimit: toListingLimit(row.listingLimit ?? metadata.listingLimit, basePlan?.listingLimit ?? 1),
    featuredCredits: toNumber(row.featuredCredits ?? metadata.featuredCredits, basePlan?.featuredCredits ?? 0),
    freeCertifications: toNumber(
      row.freeCertifications ?? metadata.freeCertifications,
      basePlan?.freeCertifications ?? 0,
    ),
    isMostPopular: Boolean(row.isMostPopular ?? metadata.isMostPopular ?? basePlan?.isMostPopular ?? false),
  };
}

async function loadPlansById(useSupabase: boolean): Promise<Map<string, PlanDetails>> {
  const now = Date.now();
  if (plansCache && now - plansCache.loadedAt < CACHE_MS) {
    return plansCache.byId;
  }

  const byId = new Map<string, PlanDetails>();
  for (const [id, plan] of Object.entries(PLAN_DETAILS)) {
    byId.set(id, plan);
  }

  if (useSupabase) {
    try {
      const allRows = await adminReadAll<Record<string, unknown>>(PLANS_TABLE);
      for (const [id, row] of Object.entries(allRows)) {
        byId.set(id, toPlanDetails(id, row));
      }
    } catch (error) {
      console.warn('⚠️ Failed to load plan overrides from Supabase; using catalog defaults:', error);
    }
  }

  plansCache = { loadedAt: now, byId };
  return byId;
}

export async function resolveSellerPlanDetails(
  seller: SellerPlanContext,
  useSupabase: boolean,
): Promise<PlanDetails> {
  const planId = (seller.subscriptionPlan || 'free') as SubscriptionPlan;
  const plans = await loadPlansById(useSupabase);
  return plans.get(planId) || PLAN_DETAILS[planId] || PLAN_DETAILS.free;
}

export function listingLimitGuardResponse(validation: ListingRenewalValidation) {
  return {
    success: false,
    reason: validation.reason,
    planExpired: validation.planExpired,
    limitReached: validation.limitReached,
    activeListings: validation.activeListings,
    limit: validation.limit,
    expiredOn: validation.expiredOn,
  };
}

export async function validateSellerCanCreateListing(
  seller: SellerPlanContext,
  sellerVehicles: Vehicle[],
  useSupabase: boolean,
): Promise<ListingRenewalValidation> {
  const planDetails = await resolveSellerPlanDetails(seller, useSupabase);
  return validateNewListingCreation(seller, sellerVehicles, planDetails);
}

export async function validateSellerCanPublishListing(
  seller: SellerPlanContext,
  vehicle: Vehicle,
  sellerVehicles: Vehicle[],
  useSupabase: boolean,
): Promise<ListingRenewalValidation> {
  const planDetails = await resolveSellerPlanDetails(seller, useSupabase);
  return validateListingRenewal(seller, vehicle, sellerVehicles, planDetails);
}

export function invalidateSellerPlanCache(): void {
  plansCache = null;
}

/** Test helper — reset cached plan overrides. */
export function __clearSellerPlanCacheForTests(): void {
  plansCache = null;
}
