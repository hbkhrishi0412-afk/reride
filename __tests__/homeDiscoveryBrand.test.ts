import { HOME_DISCOVERY_CATEGORIES, HOME_CITY_ACCENT, getHomeMobileCityAccent } from '../constants/homeDiscovery';

describe('home discovery brand system', () => {
  it('has no emoji category icons', () => {
    for (const category of HOME_DISCOVERY_CATEGORIES) {
      expect(category).not.toHaveProperty('icon');
      expect(category).not.toHaveProperty('gradient');
      expect(category).not.toHaveProperty('mobileCardGradient');
    }
  });

  it('uses one city accent for every metro', () => {
    expect(getHomeMobileCityAccent('Mumbai')).toEqual(HOME_CITY_ACCENT);
    expect(getHomeMobileCityAccent('Hyderabad').solid).toBe(HOME_CITY_ACCENT.solid);
  });
});
