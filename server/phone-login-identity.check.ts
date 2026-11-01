/**
 * Runnable check: node --experimental-strip-types server/phone-login-identity.check.ts
 * (or tsx server/phone-login-identity.check.ts)
 */
import { filterVerifiedMobileMatches, phoneMatchTail } from './phone-login-identity.js';

const tail = phoneMatchTail('+919876543210');
const matches = filterVerifiedMobileMatches(
  [
    { mobile: '9876543210', phone_verified: false, email: 'attacker@example.com' },
    { mobile: '+91 98765 43210', phone_verified: true, email: 'owner@example.com' },
    { mobile: '9123456789', phone_verified: true, email: 'other@example.com' },
  ],
  tail,
);

if (matches.length !== 1 || matches[0]?.email !== 'owner@example.com') {
  throw new Error(`expected only verified owner match, got ${JSON.stringify(matches)}`);
}

const unverifiedOnly = filterVerifiedMobileMatches(
  [{ mobile: '9876543210', phone_verified: false, email: 'attacker@example.com' }],
  tail,
);
if (unverifiedOnly.length !== 0) {
  throw new Error('unverified mobile must not auto-link');
}

console.log('phone-login-identity.check: ok');
