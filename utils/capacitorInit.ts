/**
 * Must be imported before `./App` in `index.tsx` so fetch patching runs before other code.
 * Patches relative `/api/*` for Capacitor and for the apex host `reride.co.in` → canonical API on `www`.
 */
import { ensureRerideWebCanonicalHost, restoreOAuthRoleFromUrl, patchFetchForCapacitor } from './apiConfig.js';
import { warmUpNativeGoogleSignIn } from './nativeGoogleSignIn.js';
import { warmUpWebGoogleSignIn } from './webGoogleSignIn.js';
import { initNativeGoogleOAuthReturnHandler } from './oauthMobile.js';
import { initUniversalLinksHandler } from './universalLinks.js';
import { initCapacitorAndroidBack } from './capacitorAndroidBack.js';
import { startNativeSessionHydrate } from './nativeSessionMirror.js';

ensureRerideWebCanonicalHost();
restoreOAuthRoleFromUrl();
patchFetchForCapacitor();
// Mirror → remember-me clear → token hydrate, in that order (see hydrateNativeSessionMirror).
// Auth awaits whenNativeSessionReady(); do not start token hydrates in parallel.
void startNativeSessionHydrate();
initNativeGoogleOAuthReturnHandler();
initUniversalLinksHandler();
warmUpNativeGoogleSignIn();
warmUpWebGoogleSignIn();
initCapacitorAndroidBack();
