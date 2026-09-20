import {
  HOME_DISCOVERY_CATEGORIES,
  HOME_CITY_ACCENT,
  HOME_CITY_ACCENTS,
  getHomeMobileCityAccent,
} from '../constants/homeDiscovery';

describe('home discovery brand system', () => {
  it('has no emoji category icons', () => {
    for (const category of HOME_DISCOVERY_CATEGORIES) {
      expect(category).not.toHaveProperty('icon');
      expect(category).not.toHaveProperty('gradient');
      expect(category).not.toHaveProperty('mobileCardGradient');
    }
  });

  it('gives each metro its own accent (fallback for unknown)', () => {
    expect(getHomeMobileCityAccent('Mumbai').pin).toBe(HOME_CITY_ACCENTS.Mumbai.pin);
    expect(getHomeMobileCityAccent('Hyderabad').pin).toBe(HOME_CITY_ACCENTS.Hyderabad.pin);
    expect(getHomeMobileCityAccent('Mumbai').pin).not.toBe(getHomeMobileCityAccent('Hyderabad').pin);
    expect(getHomeMobileCityAccent('Unknown City')).toEqual(HOME_CITY_ACCENT);
  });
});
