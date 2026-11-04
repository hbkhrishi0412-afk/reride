/**
 * Run: npx tsx utils/listingTrust.disclosure.check.ts
 */
import assert from 'node:assert/strict';
import { hasSellerDisclosureReport, hasVehicleDetailReport } from './listingTrust.js';
import { VehicleCategory } from '../vehicle-category.js';
import type { Vehicle } from '../types.js';

const base = {
  id: 1,
  category: VehicleCategory.FOUR_WHEELER,
  make: 'Mahindra',
  model: 'XUV400',
  year: 2024,
  price: 1,
  mileage: 1,
  images: [],
  features: [],
  description: '',
  engine: '',
  transmission: '',
  fuelType: '',
  fuelEfficiency: '',
  color: '',
  status: 'published' as const,
  sellerEmail: 'a@b.com',
};

assert.equal(hasSellerDisclosureReport(base as Vehicle), false);
assert.equal(hasVehicleDetailReport(base as Vehicle), false);

const withAnswers = {
  ...base,
  sellerDisclosureChecklist: {
    version: '1.0',
    category: VehicleCategory.FOUR_WHEELER,
    items: [
      { id: 'core.docs.challans', status: 'fail' as const, notes: 'No', photoUrl: '' },
      { id: 'core.docs.rc_photo', status: '' as const, notes: '', photoUrl: '' },
    ],
  },
};
assert.equal(hasSellerDisclosureReport(withAnswers as Vehicle), true);
assert.equal(hasVehicleDetailReport(withAnswers as Vehicle), true);

console.log('listingTrust.disclosure.check: ok');
