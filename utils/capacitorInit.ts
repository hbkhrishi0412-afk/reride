/**
 * Must be imported before `./App` in `index.tsx` so fetch patching runs before other code.
 * Patches relative `/api/*` for Capacitor and for the apex host `reride.co.in` → canonical API on `www`.
 */
import { ensureRerideWebCanonicalHost, restoreOAuthRoleFromUrl, patchFetchForCapacitor } from './apiConfig';
import { warmUpNativeGoogleSignIn } from './nativeGoogleSignIn';
import { initNativeGoogleOAuthReturnHandler } from './oauthMobile';
import { initUniversalLinksHandler } from './universalLinks';
import { initCapacitorAndroidBack } from './capacitorAndroidBack';
import { hydrateNativeTokensFromPreferences } from './nativeTokenStorage';

ensureRerideWebCanonicalHost();
restoreOAuthRoleFromUrl();
patchFetchForCapacitor();
void hydrateNativeTokensFromPreferences();
initNativeGoogleOAuthReturnHandler();
initUniversalLinksHandler();
warmUpNativeGoogleSignIn();
initCapacitorAndroidBack();
