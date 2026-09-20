import {
  getServiceDashboardNextAction,
  isRealProfileValue,
} from '../utils/serviceDashboardOverview';

describe('isRealProfileValue', () => {
  it('rejects empty and placeholder values', () => {
    expect(isRealProfileValue('')).toBe(false);
    expect(isRealProfileValue('  ')).toBe(false);
    expect(isRealProfileValue('Pending setup')).toBe(false);
    expect(isRealProfileValue('0000000000')).toBe(false);
  });

  it('accepts a real city', () => {
    expect(isRealProfileValue('Bengaluru')).toBe(true);
  });
});

describe('getServiceDashboardNextAction', () => {
  it('asks for city before availability', () => {
    const action = getServiceDashboardNextAction({
      city: 'Pending setup',
      availability: '',
      skills: [],
      workshops: [],
      activeServiceCount: 1,
      categories: [],
    });
    expect(action.kind).toBe('city');
    expect(action.label).toBe('Set city');
  });

  it('returns open-pool once setup is complete', () => {
    const action = getServiceDashboardNextAction({
      city: 'Bengaluru',
      availability: 'daily',
      skills: ['AC'],
      workshops: ['Koramangala'],
      activeServiceCount: 3,
      categories: ['Essential Service'],
    });
    expect(action.kind).toBe('open');
  });
});
