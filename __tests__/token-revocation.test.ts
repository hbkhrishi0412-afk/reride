// In-memory store path: no Upstash / Supabase KV in this test.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
jest.mock('@upstash/redis', () => ({ Redis: class {} }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => null }));

const { revokeAllUserSessions, isTokenRevokedForUser } = require('../lib/token-revocation');

const jwtWithIat = (iat: number) =>
  `h.${Buffer.from(JSON.stringify({ iat })).toString('base64url')}.s`;

describe('revokeAllUserSessions', () => {
  it('rejects tokens issued before the revocation, keeps newer ones and other users', async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await isTokenRevokedForUser(`Bearer ${jwtWithIat(now - 100)}`, 'a@x.com')).toBe(false);

    await revokeAllUserSessions('A@x.com');

    expect(await isTokenRevokedForUser(`Bearer ${jwtWithIat(now - 100)}`, 'a@x.com')).toBe(true);
    expect(await isTokenRevokedForUser(jwtWithIat(now + 1), 'a@x.com')).toBe(false);
    expect(await isTokenRevokedForUser(jwtWithIat(now - 100), 'b@x.com')).toBe(false);
  });
});
