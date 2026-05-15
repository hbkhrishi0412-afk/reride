import type { User, Vehicle } from '../types.js';

/** Show a “verified” style badge when listing or seller signals trust. */
export function showVerifiedListingBadge(vehicle: Vehicle | null | undefined): boolean {
  if (!vehicle) return false;
  if (vehicle.certificationStatus === 'certified') return true;
  if (vehicle.sellerBadges?.some((b) => b.type === 'verified')) return true;
  return false;
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

  if (showVerifiedListingBadge(vehicle)) {
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
