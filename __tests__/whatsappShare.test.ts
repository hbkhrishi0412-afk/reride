import { getVehicleListingUrl } from '../utils/whatsappShare';

describe('getVehicleListingUrl', () => {
  const assignLocation = (loc: Partial<Location> & { href?: string }) => {
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
        pathname: '/',
        hash: '#/home',
        href: 'https://example.com/#/home',
        ...loc,
      },
      writable: true,
      configurable: true,
    });
  };

  beforeEach(() => {
    assignLocation({});
  });

  it('builds hash-router URL without UTM', () => {
    expect(getVehicleListingUrl(42)).toBe('https://example.com/#/vehicle/42');
  });

  it('places UTM query before hash segment', () => {
    expect(getVehicleListingUrl(5, { medium: 'whatsapp', campaign: 'card' })).toBe(
      'https://example.com/?utm_source=share&utm_medium=whatsapp&utm_campaign=card#/vehicle/5',
    );
  });

  it('uses path-style URL when not on hash router', () => {
    assignLocation({ hash: '', pathname: '/app' });
    expect(getVehicleListingUrl(9, { source: 'share' })).toBe(
      'https://example.com/vehicle/9?utm_source=share&utm_medium=social&utm_campaign=listing',
    );
  });
});
