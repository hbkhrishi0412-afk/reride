import { isSensitiveDisclosureItem, maskVehicleIdentifier } from '../utils/vehiclePrivacy';

describe('maskVehicleIdentifier', () => {
  it('masks identifiers and keeps only last 4 chars', () => {
    expect(maskVehicleIdentifier('MH12AB1234')).toBe('••••1234');
    expect(maskVehicleIdentifier('ENG998877')).toBe('••••8877');
  });

  it('returns dash for empty values', () => {
    expect(maskVehicleIdentifier('')).toBe('-');
    expect(maskVehicleIdentifier('   ')).toBe('-');
    expect(maskVehicleIdentifier(undefined)).toBe('-');
  });

  it('supports custom suffix length', () => {
    expect(maskVehicleIdentifier('ABCDE12345', 2)).toBe('••••45');
    expect(maskVehicleIdentifier('ABCDE12345', 0)).toBe('••••');
  });
});

describe('isSensitiveDisclosureItem', () => {
  it('detects sensitive checklist item ids', () => {
    expect(isSensitiveDisclosureItem('core.docs.rc_photo')).toBe(true);
    expect(isSensitiveDisclosureItem('core.docs.insurance_cert')).toBe(true);
    expect(isSensitiveDisclosureItem('core.photos.documents')).toBe(true);
  });

  it('returns false for non-sensitive ids', () => {
    expect(isSensitiveDisclosureItem('core.photos.front')).toBe(false);
    expect(isSensitiveDisclosureItem('fw.interior.ac')).toBe(false);
  });
});
