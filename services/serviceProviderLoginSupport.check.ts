/**
 * Runnable check: node --import tsx services/serviceProviderLoginSupport.check.ts
 */
import { providerFromLoginUser, userToServiceProviderProfile } from './serviceProviderLoginSupport.js';
import type { User } from '../types.js';

const user = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  mobile: '9876543210',
  location: 'Hyderabad',
  role: 'service_provider',
} as User;

const fromUser = providerFromLoginUser(user);
const stub = userToServiceProviderProfile(user);
if (fromUser.email !== stub.email || fromUser.phone !== stub.phone) {
  throw new Error('providerFromLoginUser must fall back to users-row stub');
}

const api = { id: 'sp1', email: 'ada@example.com', skills: ['AC'] };
const merged = providerFromLoginUser(user, api);
if (merged !== api || !Array.isArray(merged.skills)) {
  throw new Error('providerFromLoginUser must prefer API profile when present');
}

console.log('serviceProviderLoginSupport.check: ok');
