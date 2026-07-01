import { LISTING_EXPIRY_DAYS, PLAN_DETAILS } from '../constants/plans.js';
import type { SubscriptionPlan, Vehicle } from '../types.js';

export interface SellerPlanContext {
  subscriptionPlan?: SubscriptionPlan | string;
  planExpiryDate?: string;
}

export interface ListingRenewalValidation {
  allowed: boolean;
  reason?: string;
  planExpired?: boolean;
  limitReached?: boolean;
  limit?: number;
  activeListings?: number;
  expiredOn?: string;
}

export function isSellerPlanExpired(seller: SellerPlanContext, now: Date = new Date()): boolean {
  if (!seller.planExpiryDate) return false;
  const expiry = new Date(seller.planExpiryDate);
  return !Number.isNaN(expiry.getTime()) && expiry < now;
}

/**
 * Listing expiry aligned with plan rules.
 * Every listing MUST have an expiry date — no infinite listings.
 * Premium listings expire when the plan expires.
 * Free/Pro listings expire after LISTING_EXPIRY_DAYS (30 days).
 */
export function computeListingExpiresAtForSeller(seller: SellerPlanContext): string {
  const plan = seller.subscriptionPlan || 'free';

  // Premium: listing expires when the plan expires
  if (plan === 'premium' && seller.planExpiryDate) {
    return seller.planExpiryDate;
  }

  // All plans (including premium without a set expiry): default 30-day window
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + LISTING_EXPIRY_DAYS);
  return expiryDate.toISOString();
}

export function getSellerPlanDetails(seller: SellerPlanContext) {
  const planKey = (seller.subscriptionPlan || 'free') as SubscriptionPlan;
  return PLAN_DETAILS[planKey] || PLAN_DETAILS.free;
}

export function countPublishedListings(vehicles: Vehicle[]): number {
  return vehicles.filter((v) => v && v.status === 'published').length;
}

export function validateListingRenewal(
  seller: SellerPlanContext,
  vehicle: Vehicle,
  sellerVehicles: Vehicle[],
): ListingRenewalValidation {
  if (isSellerPlanExpired(seller)) {
    return {
      allowed: false,
      reason: 'Your subscription plan has expired. Please renew your plan before reactivating listings.',
      planExpired: true,
      expiredOn: seller.planExpiryDate,
    };
  }

  const planDetails = getSellerPlanDetails(seller);
  const listingLimit = planDetails.listingLimit;

  if (listingLimit !== 'unlimited') {
    const numericLimit = Number(listingLimit) || 0;
    const activeAfterRenew =
      sellerVehicles.filter((v) => v && v.status === 'published' && v.id !== vehicle.id).length + 1;

    if (activeAfterRenew > numericLimit) {
      return {
        allowed: false,
        reason: `Listing limit reached for your ${planDetails.name} plan. You can have up to ${listingLimit} active listing(s). Unpublish or sell another listing first.`,
        limitReached: true,
        activeListings: countPublishedListings(sellerVehicles),
        limit: numericLimit,
      };
    }
  }

  return { allowed: true };
}

export function buildListingRenewalUpdates(
  seller: SellerPlanContext,
  vehicle: Vehicle,
): Partial<Vehicle> {
  return {
    listingExpiresAt: computeListingExpiresAtForSeller(seller),
    listingStatus: 'active',
    status: 'published',
    listingLastRefreshed: new Date().toISOString(),
    listingRenewalCount: (vehicle.listingRenewalCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}
