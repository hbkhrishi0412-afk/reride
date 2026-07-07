import type { User, Vehicle } from '../types.js';
import { computeListingTier } from '../lib/universalChecklist/helpers.js';
import { VehicleCategory } from '../vehicle-category.js';

const RC_CHECKLIST_ITEM_ID = 'core.docs.rc_photo';

/** Show a “verified” style badge when listing has full photo evidence on Universal Checklist. */
export function showVerifiedListingBadge(vehicle: Vehicle | null | undefined): boolean {
  if (!vehicle) return false;
  if (vehicle.certificationStatus === 'certified') return true;
  if (vehicle.sellerBadges?.some((b) => b.type === 'verified')) return true;
  const checklist = vehicle.sellerDisclosureChecklist;
  if (checklist?.listingTier === 'verified') return true;
  if (checklist?.items?.length) {
    const tier = computeListingTier(
      checklist,
      checklist.category || vehicle.category || VehicleCategory.FOUR_WHEELER,
    );
    if (tier === 'verified') return true;
  }
  return false;
}

export function getListingChecklistTier(vehicle: Vehicle | null | undefined): 'verified' | 'basic' | null {
  if (!vehicle?.sellerDisclosureChecklist?.items?.length) return null;
  const c = vehicle.sellerDisclosureChecklist;
  return (
    c.listingTier ??
    computeListingTier(c, c.category || vehicle.category || VehicleCategory.FOUR_WHEELER)
  );
}

/** RC photo in checklist, RC document on file, or Vahan-verified registration. */
export function vehicleHasRcOnListing(vehicle: Vehicle | null | undefined): boolean {
  if (!vehicle) return false;

  const rcFromChecklist = vehicle.sellerDisclosureChecklist?.items?.find(
    (item) => item.id === RC_CHECKLIST_ITEM_ID && item.photoUrl?.trim(),
  );
  if (rcFromChecklist) return true;

  if (
    vehicle.documents?.some(
      (doc) => doc.url?.trim() && (doc.name === 'Registration Certificate (RC)' || doc.name.includes('RC')),
    )
  ) {
    return true;
  }

  if (vehicle.registrationNumber?.trim() && vehicle.vahanVerifiedAt) {
    return true;
  }

  return false;
}

/** Ready for a tracked deal: RC + photos + core listing fields (verified tier is a fast-path). */
export function vehicleIsDealReady(vehicle: Vehicle | null | undefined): boolean {
  if (!vehicle) return false;
  if (!vehicleHasRcOnListing(vehicle)) return false;
  if (!vehicle.price || vehicle.price <= 0) return false;
  if ((vehicle.images?.length ?? 0) < 2) return false;

  if (showVerifiedListingBadge(vehicle)) return true;

  return Boolean(
    vehicle.rto?.trim() &&
      vehicle.make?.trim() &&
      vehicle.model?.trim() &&
      vehicle.noOfOwners >= 1 &&
      vehicle.year > 0,
  );
}

export function vehicleIsSingleOwner(vehicle: Vehicle | null | undefined): boolean {
  return Boolean(vehicle && vehicle.noOfOwners === 1);
}

export type TrustFilterValue = '' | 'rc_uploaded' | 'verified_listing' | 'deal_ready' | 'single_owner';

export type TrustSignalId = Exclude<TrustFilterValue, ''>;

export interface ListingTrustSignalDefinition {
  id: TrustSignalId;
  labelKey: string;
  defaultLabel: string;
  hintKey: string;
  defaultHint: string;
}

/** Single source of truth for buyer filters and listing trust badges. */
export const LISTING_TRUST_SIGNALS: readonly ListingTrustSignalDefinition[] = [
  {
    id: 'rc_uploaded',
    labelKey: 'listings.trustFilter.rc',
    defaultLabel: 'RC on listing',
    hintKey: 'trust.signal.hint.rc',
    defaultHint: 'Upload RC photos in the disclosure checklist',
  },
  {
    id: 'verified_listing',
    labelKey: 'listings.trustFilter.verified',
    defaultLabel: 'Verified listing',
    hintKey: 'trust.signal.hint.verified',
    defaultHint: 'Complete all checklist items with photo evidence',
  },
  {
    id: 'deal_ready',
    labelKey: 'listings.trustFilter.dealReady',
    defaultLabel: 'Deal-ready',
    hintKey: 'trust.signal.hint.dealReady',
    defaultHint: 'Add RC, photos, price, and core vehicle details',
  },
  {
    id: 'single_owner',
    labelKey: 'listings.trustFilter.singleOwner',
    defaultLabel: 'Single owner',
    hintKey: 'trust.signal.hint.singleOwner',
    defaultHint: 'Set number of owners to 1 in listing details',
  },
] as const;

export interface ListingTrustSignalStatus extends ListingTrustSignalDefinition {
  met: boolean;
}

export function evaluateTrustSignal(
  vehicle: Vehicle | null | undefined,
  signalId: TrustSignalId,
): boolean {
  if (!vehicle) return false;
  switch (signalId) {
    case 'rc_uploaded':
      return vehicleHasRcOnListing(vehicle);
    case 'verified_listing':
      return showVerifiedListingBadge(vehicle);
    case 'deal_ready':
      return vehicleIsDealReady(vehicle);
    case 'single_owner':
      return vehicleIsSingleOwner(vehicle);
    default:
      return false;
  }
}

export function getListingTrustSignalStatuses(
  vehicle: Vehicle | null | undefined,
): ListingTrustSignalStatus[] {
  return LISTING_TRUST_SIGNALS.map((signal) => ({
    ...signal,
    met: evaluateTrustSignal(vehicle, signal.id),
  }));
}

export type ListingTrustChip = {
  id: string;
  labelKey: string;
  defaultLabel: string;
  tone: 'emerald' | 'blue' | 'amber' | 'purple';
};

/** Listing-level trust signals for detail cards and chips (met signals only). */
export function getListingTrustChips(
  vehicle: Vehicle | null | undefined,
  seller?: User | null,
): ListingTrustChip[] {
  if (!vehicle) return [];

  const chips: ListingTrustChip[] = getListingTrustSignalStatuses(vehicle)
    .filter((signal) => signal.met)
    .map((signal) => ({
      id: signal.id,
      labelKey: signal.labelKey,
      defaultLabel: signal.defaultLabel,
      tone:
        signal.id === 'verified_listing' || signal.id === 'rc_uploaded' || signal.id === 'deal_ready'
          ? 'emerald'
          : signal.id === 'single_owner'
            ? 'blue'
            : 'amber',
    }));

  if (vehicle.certifiedInspection || vehicle.certificationStatus === 'certified') {
    chips.push({
      id: 'inspected',
      labelKey: 'trust.chip.inspected',
      defaultLabel: 'Inspected',
      tone: 'purple',
    });
  }

  if (seller?.phoneVerified && !chips.some((c) => c.id === 'phone_verified')) {
    chips.push({
      id: 'phone_verified',
      labelKey: 'trust.chip.phoneVerified',
      defaultLabel: 'Phone verified',
      tone: 'emerald',
    });
  }

  return chips;
}

export function vehicleMatchesTrustFilter(
  vehicle: Vehicle,
  filter: TrustFilterValue,
): boolean {
  if (!filter) return true;
  return evaluateTrustSignal(vehicle, filter);
}

/** 0–100 score for "most complete listing" sort. */
export function getListingDisclosureScore(vehicle: Vehicle | null | undefined): number {
  if (!vehicle) return 0;
  let score = 0;
  if (vehicleHasRcOnListing(vehicle)) score += 25;
  if ((vehicle.images?.length ?? 0) >= 3) score += 15;
  const tier = getListingChecklistTier(vehicle);
  if (tier === 'verified') score += 25;
  else if (tier === 'basic') score += 10;
  if (showVerifiedListingBadge(vehicle)) score += 10;
  if (vehicleIsDealReady(vehicle)) score += 15;
  if (vehicleIsSingleOwner(vehicle)) score += 5;
  if (vehicle.vahanVerifiedAt) score += 5;
  return Math.min(100, score);
}
