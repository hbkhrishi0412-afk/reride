import {
  assignedWorkshopId,
  catalogHasPricedMenu,
  catalogStartingFrom,
  collectProviderIdAliases,
  incomingVisibleToProvider,
  providerMatchesActor,
  workshopHasAnyActiveService,
  workshopIsListed,
  workshopOffersAllTypes,
} from '../utils/workshopBooking';

describe('workshopBooking', () => {
  it('collects unique non-empty aliases', () => {
    expect(collectProviderIdAliases('uid-1', 'uid-1', '', 'email-key', null)).toEqual([
      'uid-1',
      'email-key',
    ]);
  });

  it('matches stored provider id against JWT or auth uid aliases', () => {
    const aliases = collectProviderIdAliases('email-key', 'auth-uid');
    expect(providerMatchesActor('auth-uid', aliases)).toBe(true);
    expect(providerMatchesActor('email-key', aliases)).toBe(true);
    expect(providerMatchesActor('someone-else', aliases)).toBe(false);
  });

  it('treats an assigned order as incoming only for that workshop', () => {
    const aliases = ['auth-uid'];
    expect(
      incomingVisibleToProvider({ providerId: 'auth-uid', candidateProviderIds: [] }, aliases),
    ).toBe(true);
    expect(
      incomingVisibleToProvider({ providerId: 'other', candidateProviderIds: ['auth-uid'] }, aliases),
    ).toBe(false);
    expect(incomingVisibleToProvider({ providerId: null, candidateProviderIds: [] }, aliases)).toBe(
      false,
    );
    expect(
      incomingVisibleToProvider({ providerId: null, candidateProviderIds: ['auth-uid'] }, aliases),
    ).toBe(true);
  });

  it('prefers providerId then first candidate for the assigned workshop', () => {
    expect(assignedWorkshopId({ providerId: 'w1', candidateProviderIds: ['w2'] })).toBe('w1');
    expect(assignedWorkshopId({ providerId: null, candidateProviderIds: ['w2'] })).toBe('w2');
    expect(assignedWorkshopId({ providerId: null, candidateProviderIds: [] })).toBeNull();
  });

  it('requires the workshop menu to cover every selected service type', () => {
    const menu = [
      { serviceType: 'Periodic Services', active: true },
      { serviceType: 'Car AC Servicing', active: true },
      { serviceType: 'Denting & Painting', active: false },
    ];
    expect(workshopOffersAllTypes(menu, ['Periodic Services'])).toBe(true);
    expect(workshopOffersAllTypes(menu, ['Periodic Services', 'Car AC Servicing'])).toBe(true);
    expect(workshopOffersAllTypes(menu, ['Periodic Services', 'Denting & Painting'])).toBe(false);
    expect(workshopOffersAllTypes(menu, ['Essential Service'])).toBe(false);
    expect(workshopHasAnyActiveService(menu)).toBe(true);
  });

  it('lists a workshop only with a real city and a priced menu', () => {
    const menu = { 'Periodic Services': { serviceType: 'Periodic Services', price: 2499, active: true } };
    expect(catalogHasPricedMenu(menu)).toBe(true);
    expect(catalogStartingFrom(menu)).toBe(2499);
    expect(workshopIsListed({ city: 'Mumbai', hasPricedMenu: true })).toBe(true);
    expect(workshopIsListed({ city: 'Pending setup', hasPricedMenu: true })).toBe(false);
    expect(workshopIsListed({ city: 'Mumbai', hasPricedMenu: false })).toBe(false);
  });
});
