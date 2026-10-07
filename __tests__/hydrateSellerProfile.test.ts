import { hydrateSellerProfile } from '../hooks/useAppLocationSync';
import type { User } from '../types';

const real = { id: 'u1', email: 'speedy@auto.com', name: 'Speedy Auto', role: 'seller' } as User;

function run(email: string, users: User[], prev: User | null) {
  let state = prev;
  const set = (v: any) => { state = typeof v === 'function' ? v(state) : v; };
  hydrateSellerProfile(email, users, set);
  return state as User | null;
}

beforeEach(() => localStorage.clear());

test('resolves the seller from app users', () => {
  expect(run('speedy@auto.com', [real], null)).toBe(real);
});

test('falls back to the cached dealer directory before showing a placeholder', () => {
  localStorage.setItem('reRideDealerDirectory_v1', JSON.stringify([real]));
  expect(run('speedy@auto.com', [], null)).toEqual(real);
});

test('placeholder is upgraded once the real seller is known, and a resolved profile is kept', () => {
  const placeholder = run('nobody@auto.com', [], null);
  expect(placeholder?.name).toBe('Seller');
  const upgraded = { ...real, email: 'nobody@auto.com' };
  expect(run('nobody@auto.com', [upgraded], placeholder)).toBe(upgraded);
  expect(run('speedy@auto.com', [], real)).toBe(real);
});
