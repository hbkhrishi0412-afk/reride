/**
 * @jest-environment jsdom
 */

import { View } from '../types';
import {
  consumeDeepLinkParams,
  getPendingDeepLinkVehicleId,
  matchDeepLinkView,
  parseDeepLink,
  setPendingDeepLinkVehicleId,
} from '../utils/mobileFeatures';

describe('parseDeepLink', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.location.hash = '';
    setPendingDeepLinkVehicleId(null);
  });

  it('reads a normal search query', () => {
    window.history.replaceState({}, '', '/?view=detail&id=7');
    expect(parseDeepLink()).toMatchObject({ view: 'detail', id: '7' });
  });

  it('reads the query from the hash when search is empty', () => {
    window.history.replaceState({}, '', '/');
    window.location.hash = '#/?view=detail&id=42';
    expect(parseDeepLink()).toMatchObject({ view: 'detail', id: '42' });
  });

  it('strips view and id from search and hash so the link cannot re-apply', () => {
    window.history.replaceState({}, '', '/?view=detail&id=7&utm=1');
    window.location.hash = '#/used-cars?view=detail&id=7';
    consumeDeepLinkParams();
    expect(parseDeepLink().view).toBeUndefined();
    expect(parseDeepLink().id).toBeUndefined();
    expect(window.location.search).toContain('utm=1');
    expect(window.location.hash).toMatch(/#\/used-cars/);
  });

  it('matches share-link view=detail to the DETAIL enum', () => {
    expect(matchDeepLinkView('detail', Object.values(View))).toBe(View.DETAIL);
    expect(matchDeepLinkView('DETAIL', Object.values(View))).toBe(View.DETAIL);
  });

  it('stashes the vehicle id while the catalog loads', () => {
    setPendingDeepLinkVehicleId(99);
    expect(getPendingDeepLinkVehicleId()).toBe(99);
    setPendingDeepLinkVehicleId(null);
    expect(getPendingDeepLinkVehicleId()).toBeNull();
  });
});
