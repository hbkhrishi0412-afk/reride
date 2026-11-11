/**
 * Runnable check: fixed-format description stays coherent with missing fields.
 * Run: npx tsx utils/buildVehicleDescription.check.ts
 */
import assert from 'node:assert/strict';
import {
  buildVehicleDescription,
  normalizeVehicleDescription,
  parseVehicleDescription,
  VEHICLE_DESCRIPTION_MAX_LENGTH,
} from './buildVehicleDescription.js';

function main() {
  const full = buildVehicleDescription({
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    year: 2020,
    registrationYear: 2020,
    mileage: 45000,
    noOfOwners: 1,
    city: 'Mumbai',
    state: 'mh',
    rto: 'mh01',
    price: 1250000,
    transmission: 'Automatic',
    fuelType: 'Petrol',
    fuelEfficiency: '16 KMPL',
    color: 'White',
    insuranceType: 'Comprehensive',
    insuranceValidity: 'Aug 2026',
    features: ['Sunroof', 'ABS'],
  });

  assert.match(full, /^2020 Hyundai Creta SX/);
  assert.match(full, /\n\nOVERVIEW\n/);
  assert.match(full, /\n\nSPECIFICATIONS\n/);
  assert.match(full, /\n\nKEY FEATURES\n/);
  assert.match(full, /• Make year: 2020/);
  assert.match(full, /1st owner/);
  assert.match(full, /Location: Mumbai, MH/);
  assert.match(full, /RTO: MH01/);
  assert.ok(full.length <= VEHICLE_DESCRIPTION_MAX_LENGTH);

  const parsed = parseVehicleDescription(full);
  assert.equal(parsed.title, '2020 Hyundai Creta SX');
  assert.equal(parsed.sections.length, 3);
  assert.equal(parsed.sections[0].heading, 'OVERVIEW');
  assert.ok(parsed.sections[0].bullets.some((b) => b.startsWith('Make year:')));
  assert.equal(parsed.sections[1].heading, 'SPECIFICATIONS');
  assert.equal(parsed.sections[2].heading, 'KEY FEATURES');
  assert.ok(parsed.paragraphs.some((p) => /Professionally listed/.test(p)));

  // Flattened auto copy (no newlines) must still organise for display
  const flat =
    '2024 Mahindra XUV300 W4 OVERVIEW • Make year: 2024 • Km driven: 47,072 km SPECIFICATIONS • Fuel type: Electric Professionally listed with clear ownership.';
  const repaired = normalizeVehicleDescription(flat);
  assert.match(repaired, /\n/);
  const flatParsed = parseVehicleDescription(flat);
  assert.equal(flatParsed.title, '2024 Mahindra XUV300 W4');
  assert.ok(flatParsed.sections.some((s) => s.heading === 'OVERVIEW'));
  assert.ok(flatParsed.sections.some((s) => s.heading === 'SPECIFICATIONS'));

  const sparse = buildVehicleDescription({
    make: 'Honda',
    model: 'City',
    year: 2018,
    fuelType: 'Petrol',
  });
  assert.match(sparse, /^2018 Honda City/);
  assert.match(sparse, /Fuel type: Petrol/);
  assert.doesNotMatch(sparse, /Km driven/);
  assert.doesNotMatch(sparse, /undefined|null|N\/A/i);
  assert.match(sparse, /Professionally listed/);

  assert.equal(buildVehicleDescription({}), '');
  assert.equal(buildVehicleDescription({ make: '  ' }), '');

  const zeroKm = buildVehicleDescription({ make: 'Tata', model: 'Nexon', year: 2024, mileage: 0 });
  assert.match(zeroKm, /Km driven: 0 km/);

  console.log('buildVehicleDescription.check: ok');
}

main();
