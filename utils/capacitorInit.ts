/**
 * Must be imported before `./App` in `index.tsx` so fetch patching runs before other code.
 * Patches relative `/api/*` for Capacitor and for the apex host `reride.co.in` → canonical API on `www`.
 */
import { ensureRerideWebCanonicalHost, restoreOAuthRoleFromUrl, patchFetchForCapacitor } from './apiConfig';
import { warmUpNativeGoogleSignIn } from './nativeGoogleSignIn';
import { initNativeGoogleOAuthReturnHandler } from './oauthMobile';
import { initCapacitorAndroidBack } from './capacitorAndroidBack';

ensureRerideWebCanonicalHost();
restoreOAuthRoleFromUrl();
patchFetchForCapacitor();
initNativeGoogleOAuthReturnHandler();
warmUpNativeGoogleSignIn();
initCapacitorAndroidBack();
