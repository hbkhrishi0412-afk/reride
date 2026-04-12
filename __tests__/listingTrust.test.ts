import type { Vehicle } from '../types';
import { showVerifiedListingBadge } from '../utils/listingTrust';

describe('showVerifiedListingBadge', () => {
  it('returns false for null/undefined', () => {
    expect(showVerifiedListingBadge(null)).toBe(false);
    expect(showVerifiedListingBadge(undefined)).toBe(false);
  });

  it('is true when certification is certified', () => {
    const v = { certificationStatus: 'certified' } as Vehicle;
    expect(showVerifiedListingBadge(v)).toBe(true);
  });

  it('is true when seller has verified badge', () => {
    const v = { sellerBadges: [{ type: 'verified' as const }] } as Vehicle;
    expect(showVerifiedListingBadge(v)).toBe(true);
  });

  it('is false otherwise', () => {
    const v = { certificationStatus: 'none', sellerBadges: [] } as unknown as Vehicle;
    expect(showVerifiedListingBadge(v)).toBe(false);
  });
});
