import type { User, Vehicle } from '../types.js';
import { computeListingTier } from '../lib/universalChecklist/helpers.js';
import { VehicleCategory } from '../vehicle-category.js';

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

export type ListingTrustChip = {
  id: string;
  labelKey: string;
  defaultLabel: string;
  tone: 'emerald' | 'blue' | 'amber' | 'purple';
};

/** Listing-level trust signals for detail cards and chips. */
export function getListingTrustChips(
  vehicle: Vehicle | null | undefined,
  seller?: User | null,
): ListingTrustChip[] {
  if (!vehicle) return [];
  const chips: ListingTrustChip[] = [];

  const tier = getListingChecklistTier(vehicle);
  if (tier === 'verified') {
    chips.push({
      id: 'verified',
      labelKey: 'trust.chip.verifiedListing',
      defaultLabel: 'Verified Listing',
      tone: 'emerald',
    });
  } else if (tier === 'basic') {
    chips.push({
      id: 'basic_self_reported',
      labelKey: 'trust.chip.basicListing',
      defaultLabel: 'Basic — Self Reported',
      tone: 'amber',
    });
  } else if (showVerifiedListingBadge(vehicle)) {
    chips.push({
      id: 'verified',
      labelKey: 'trust.chip.verified',
      defaultLabel: 'Verified listing',
      tone: 'emerald',
    });
  }

  if (vehicle.certifiedInspection || vehicle.certificationStatus === 'certified') {
    chips.push({
      id: 'inspected',
      labelKey: 'trust.chip.inspected',
      defaultLabel: 'Inspected',
      tone: 'purple',
    });
  }
  if (vehicle.noOfOwners === 1) {
    chips.push({
      id: 'single_owner',
      labelKey: 'trust.chip.singleOwner',
      defaultLabel: 'Single owner',
      tone: 'blue',
    });
  }
  if (vehicle.documents?.length) {
    chips.push({
      id: 'docs',
      labelKey: 'trust.chip.docs',
      defaultLabel: 'Docs on file',
      tone: 'amber',
    });
  }
  if (seller?.phoneVerified) {
    chips.push({
      id: 'phone_verified',
      labelKey: 'trust.chip.phoneVerified',
      defaultLabel: 'Phone verified',
      tone: 'emerald',
    });
  }

  return chips;
}
