import type { Vehicle } from '../types';
import {
  evaluateTrustSignal,
  getListingDisclosureScore,
  getListingTrustSignalStatuses,
  showVerifiedListingBadge,
  vehicleHasRcOnListing,
  vehicleIsDealReady,
  vehicleIsSingleOwner,
  vehicleMatchesTrustFilter,
} from '../utils/listingTrust';

const baseVehicle = {
  id: 1,
  category: 'four_wheeler',
  make: 'Maruti',
  model: 'Swift',
  year: 2022,
  price: 500000,
  mileage: 20000,
  images: ['a.jpg', 'b.jpg'],
  features: [],
  description: 'Test',
  sellerEmail: 'seller@test.com',
  engine: '1.2',
  transmission: 'Manual',
  fuelType: 'Petrol',
  fuelEfficiency: '18',
  color: 'White',
  status: 'published',
  isFeatured: false,
  registrationYear: 2022,
  insuranceValidity: '2026',
  insuranceType: 'Comprehensive',
  rto: 'MH12',
  city: 'Pune',
  state: 'MH',
  location: 'Pune, MH',
  noOfOwners: 1,
  displacement: '1197 cc',
  groundClearance: '163 mm',
  bootSpace: '268 litres',
} as unknown as Vehicle;

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

describe('vehicleHasRcOnListing', () => {
  it('is false without RC evidence', () => {
    expect(vehicleHasRcOnListing(baseVehicle)).toBe(false);
  });

  it('is true with RC checklist photo', () => {
    const v = {
      ...baseVehicle,
      sellerDisclosureChecklist: {
        items: [{ id: 'core.docs.rc_photo', photoUrl: 'https://cdn/rc.jpg', status: 'pass' }],
      },
    } as Vehicle;
    expect(vehicleHasRcOnListing(v)).toBe(true);
  });

  it('is true with RC document', () => {
    const v = {
      ...baseVehicle,
      documents: [{ name: 'Registration Certificate (RC)', url: 'https://cdn/rc.pdf', fileName: 'rc.pdf' }],
    } as Vehicle;
    expect(vehicleHasRcOnListing(v)).toBe(true);
  });

  it('is true with Vahan-verified registration', () => {
    const v = {
      ...baseVehicle,
      registrationNumber: 'MH12AB1234',
      vahanVerifiedAt: '2026-01-01T00:00:00.000Z',
    } as Vehicle;
    expect(vehicleHasRcOnListing(v)).toBe(true);
  });
});

describe('vehicleIsDealReady', () => {
  it('requires RC, price, and photos', () => {
    expect(vehicleIsDealReady(baseVehicle)).toBe(false);
    const ready = {
      ...baseVehicle,
      sellerDisclosureChecklist: {
        items: [{ id: 'core.docs.rc_photo', photoUrl: 'https://cdn/rc.jpg', status: 'pass' }],
      },
    } as Vehicle;
    expect(vehicleIsDealReady(ready)).toBe(true);
  });

  it('is true when listing is verified even with minimal extras', () => {
    const v = {
      ...baseVehicle,
      images: ['a.jpg', 'b.jpg'],
      sellerDisclosureChecklist: {
        listingTier: 'verified',
        items: [{ id: 'core.docs.rc_photo', photoUrl: 'https://cdn/rc.jpg', status: 'pass' }],
      },
    } as Vehicle;
    expect(vehicleIsDealReady(v)).toBe(true);
  });
});

describe('trust signal statuses', () => {
  it('returns four signals with met flags', () => {
    const statuses = getListingTrustSignalStatuses({
      ...baseVehicle,
      sellerDisclosureChecklist: {
        listingTier: 'verified',
        items: [{ id: 'core.docs.rc_photo', photoUrl: 'https://cdn/rc.jpg', status: 'pass' }],
      },
    } as Vehicle);
    expect(statuses).toHaveLength(4);
    expect(statuses.find((s) => s.id === 'single_owner')?.met).toBe(true);
    expect(statuses.find((s) => s.id === 'rc_uploaded')?.met).toBe(true);
    expect(statuses.find((s) => s.id === 'verified_listing')?.met).toBe(true);
    expect(statuses.find((s) => s.id === 'deal_ready')?.met).toBe(true);
  });

  it('filters listings consistently', () => {
    const v = { ...baseVehicle, noOfOwners: 2 } as Vehicle;
    expect(vehicleMatchesTrustFilter(v, 'single_owner')).toBe(false);
    expect(evaluateTrustSignal(v, 'single_owner')).toBe(false);
    expect(vehicleIsSingleOwner(v)).toBe(false);
  });
});

describe('getListingDisclosureScore', () => {
  it('scores higher for more complete listings', () => {
    const basic = getListingDisclosureScore(baseVehicle);
    const rich = getListingDisclosureScore({
      ...baseVehicle,
      sellerDisclosureChecklist: {
        listingTier: 'verified',
        items: [{ id: 'core.docs.rc_photo', photoUrl: 'https://cdn/rc.jpg', status: 'pass' }],
      },
      images: ['a.jpg', 'b.jpg', 'c.jpg'],
      vahanVerifiedAt: '2026-01-01T00:00:00.000Z',
    } as Vehicle);
    expect(rich).toBeGreaterThan(basic);
  });
});
