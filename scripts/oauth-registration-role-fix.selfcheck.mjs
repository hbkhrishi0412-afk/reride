/**
 * Assert the Google OAuth registration role fix (no frameworks).
 *
 * Root cause: the `handle_new_user` Postgres trigger inserts a stub
 * `public.users` row (role defaults to 'customer') the instant Supabase Auth
 * creates the account, before the `/api/users` `oauth-login` handler ever
 * runs. That made every brand-new Google *registration* fall into the
 * "existing user found" branch instead of the "create new user" branch,
 * silently discarding the role/mobile/location picked on the Register form.
 *
 * Run: node scripts/oauth-registration-role-fix.selfcheck.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('server/main-api/marketplace-handlers.ts', 'utf8');

const existingUserIdx = src.indexOf("OAuth login - Existing user found");
assert.ok(existingUserIdx > 0, 'existing-user OAuth branch missing');

const block = src.slice(existingUserIdx, existingUserIdx + 1600);

assert.ok(
  block.includes('isFreshUntouchedStub'),
  'must detect trigger-created stub rows before trusting the existing-user branch',
);
assert.ok(
  block.includes('user.createdAt === user.updatedAt'),
  'stub detection must require the row was never edited (createdAt === updatedAt)',
);
assert.ok(
  /stubAgeMs\s*<\s*5\s*\*\s*60\s*\*\s*1000/.test(block),
  'stub detection must be time-bounded so real dormant accounts are never touched',
);
assert.ok(
  block.includes('sanitizedData.role !== user.role'),
  'must only overwrite role when it actually differs from the requested role',
);
assert.ok(
  block.includes('core.userService.update(normalizedEmail, roleUpdate)'),
  'must persist the picked role/mobile/location onto the trigger-created stub',
);

// The fix must not run on the "create new user" branch — only for accounts
// findByEmail() already found (the stub-row race case).
const createBranchIdx = src.indexOf('OAuth registration - Creating new user');
assert.ok(createBranchIdx > 0 && createBranchIdx < existingUserIdx, 'create-user branch must run first');

console.log('oauth-registration-role-fix.selfcheck: ok');
