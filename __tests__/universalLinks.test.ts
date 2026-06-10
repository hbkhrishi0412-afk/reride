/**
 * @jest-environment jsdom
 */

import { applyUniversalLink } from '../utils/universalLinks';

describe('universalLinks', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('redirects protected deep links to login when guest', () => {
    applyUniversalLink('https://www.reride.co.in/inbox');
    expect(window.location.hash).toBe('#/login');
  });

  it('applies public vehicle links for guests', () => {
    applyUniversalLink('https://www.reride.co.in/vehicle/42');
    expect(window.location.hash).toBe('#/vehicle/42');
  });

  it('allows protected links when a session exists', () => {
    localStorage.setItem(
      'reRideCurrentUser',
      JSON.stringify({ email: 'buyer@test.com', role: 'customer' }),
    );
    applyUniversalLink('https://www.reride.co.in/inbox');
    expect(window.location.hash).toBe('#/inbox');
  });
});
