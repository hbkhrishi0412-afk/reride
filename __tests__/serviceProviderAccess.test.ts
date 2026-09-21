import { View } from '../types';
import { homeViewForActor, isServiceProviderActor } from '../utils/serviceProviderAccess';

describe('serviceProviderAccess', () => {
  it('treats role or provider session as service-provider actor', () => {
    expect(isServiceProviderActor({ role: 'service_provider' }, null)).toBe(true);
    expect(isServiceProviderActor(null, { email: 'p@test.com' })).toBe(true);
    expect(isServiceProviderActor({ role: 'customer' }, null)).toBe(false);
    expect(isServiceProviderActor(null, null)).toBe(false);
  });

  it('sends logged-in providers home to their dashboard', () => {
    expect(homeViewForActor(null, { email: 'p@test.com' })).toBe(View.CAR_SERVICE_DASHBOARD);
    expect(homeViewForActor({ role: 'service_provider' }, null)).toBe(View.CAR_SERVICE_DASHBOARD);
    expect(homeViewForActor({ role: 'customer' }, null)).toBe(View.HOME);
    expect(homeViewForActor(null, null)).toBe(View.HOME);
  });
});
