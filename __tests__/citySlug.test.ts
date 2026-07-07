import { cityNameToSlug, citySlugToName, parseCityFromPath } from '../utils/citySlug.js';

describe('citySlug', () => {
  it('round-trips known cities', () => {
    expect(cityNameToSlug('Mumbai')).toBe('mumbai');
    expect(citySlugToName('mumbai')).toBe('Mumbai');
    expect(citySlugToName('new-delhi')).toBe('New Delhi');
  });

  it('parses city from path', () => {
    expect(parseCityFromPath('/city/mumbai')).toBe('Mumbai');
    expect(parseCityFromPath('/city/new-delhi')).toBe('New Delhi');
    expect(parseCityFromPath('/used-cars')).toBeNull();
  });
});
