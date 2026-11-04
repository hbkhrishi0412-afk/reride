/**
 * Runnable check: web Google id-token helpers stay gated correctly.
 * Run: npx tsx utils/webGoogleSignIn.check.ts
 */
import assert from 'node:assert/strict';

async function main() {
  const { shouldTryWebGoogleIdToken } = await import('./webGoogleSignIn.js');

  // Node has no window / Capacitor — must stay off so SSR and tests never hit GIS.
  assert.equal(shouldTryWebGoogleIdToken(), false);

  console.log('webGoogleSignIn.check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
