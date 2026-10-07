import type { Vehicle } from '../types';
import { VehicleCategory } from '../vehicle-category';
import { getSellerDefinitions } from '../lib/universalChecklist/items';
import { sanitizeSellerChecklist } from '../lib/universalChecklist/helpers';
import {
  evaluateTrustSignal,
  hasFullDisclosure,
  getListingDisclosureScore,
  getListingTrustRail,
  getListingTrustSignalStatuses,
  showVerifiedListingBadge,
  vehicleHasRcOnListing,
  vehicleHasVerifiedSeller,
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

const completeItems = getSellerDefinitions(VehicleCategory.FOUR_WHEELER).map((d) => ({
  id: d.id,
  status: 'pass' as const,
  notes: 'ok',
  photoUrl: 'https://cdn/x.jpg',
}));

const fullyDisclosedVehicle = {
  ...baseVehicle,
  category: VehicleCategory.FOUR_WHEELER,
  sellerDisclosureChecklist: { version: '1.0', category: VehicleCategory.FOUR_WHEELER, items: completeItems },
} as unknown as Vehicle;

describe('hasFullDisclosure', () => {
  it('is true when every required item has evidence', () => {
    expect(hasFullDisclosure(fullyDisclosedVehicle)).toBe(true);
  });

  it('ignores a stored listingTier that the items do not support', () => {
    const faked = {
      ...baseVehicle,
      sellerDisclosureChecklist: {
        listingTier: 'verified',
        items: [{ id: 'core.docs.rc_photo', photoUrl: 'https://cdn/rc.jpg', status: 'pass' }],
      },
    } as Vehicle;
    expect(hasFullDisclosure(faked)).toBe(false);
  });
});

describe('sanitizeSellerChecklist', () => {
  it('recomputes the tier and strips unknown items and non-http photos', () => {
    const out = sanitizeSellerChecklist(
      {
        listingTier: 'verified',
        items: [
          { id: 'core.docs.rc_photo', status: 'pass', photoUrl: 'data:image/png;base64,AAAA' },
          { id: 'not.a.real.item', status: 'pass', photoUrl: 'https://cdn/x.jpg' },
        ],
      },
      VehicleCategory.FOUR_WHEELER,
    );
    expect(out?.listingTier).toBe('basic');
    expect(out?.items.map((i) => i.id)).toEqual(['core.docs.rc_photo']);
    expect(out?.items[0].photoUrl).toBe('');
  });

  it('keeps a genuinely complete checklist verified', () => {
    expect(sanitizeSellerChecklist({ items: completeItems }, VehicleCategory.FOUR_WHEELER)?.listingTier).toBe('verified');
  });

  it('rejects non-object input', () => {
    expect(sanitizeSellerChecklist('nope', VehicleCategory.FOUR_WHEELER)).toBeNull();
  });
});

describe('showVerifiedListingBadge', () => {
  it('returns false for null/undefined', () => {
    expect(showVerifiedListingBadge(null)).toBe(false);
    expect(showVerifiedListingBadge(undefined)).toBe(false);
  });

  it('is true when certification is certified', () => {
    const v = { certificationStatus: 'certified' } as Vehicle;
    expect(showVerifiedListingBadge(v)).toBe(true);
  });

  it('is not granted by a seller badge or a completed checklist', () => {
    expect(showVerifiedListingBadge({ sellerBadges: [{ type: 'verified' as const }] } as Vehicle)).toBe(false);
    expect(showVerifiedListingBadge(fullyDisclosedVehicle)).toBe(false);
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
    expect(statuses.find((s) => s.id === 'verified_listing')?.met).toBe(false);
    expect(statuses.find((s) => s.id === 'deal_ready')?.met).toBe(true);
    expect(evaluateTrustSignal(fullyDisclosedVehicle, 'verified_listing')).toBe(true);
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

describe('getListingTrustRail', () => {
  it('always returns RC, seller, and deal slots', () => {
    const rail = getListingTrustRail(baseVehicle);
    expect(rail.map((s) => s.id)).toEqual(['rc', 'seller', 'deal']);
    expect(rail.every((s) => typeof s.met === 'boolean')).toBe(true);
  });

  it('marks RC and seller when evidence exists', () => {
    const v = {
      ...baseVehicle,
      sellerBadges: [{ type: 'verified', label: 'Verified', description: '' }],
      sellerDisclosureChecklist: {
        items: [{ id: 'core.docs.rc_photo', photoUrl: 'https://cdn/rc.jpg', status: 'pass' }],
      },
    } as Vehicle;
    const rail = getListingTrustRail(v);
    expect(rail.find((s) => s.id === 'rc')?.met).toBe(true);
    expect(rail.find((s) => s.id === 'seller')?.met).toBe(true);
    expect(vehicleHasVerifiedSeller(v)).toBe(true);
  });
});
