/**
 * Must be imported before `./App` in `index.tsx` so fetch patching runs before other code.
 * Patches relative `/api/*` for Capacitor and for the apex host `reride.co.in` → canonical API on `www`.
 */
import { patchFetchForCapacitor } from './apiConfig';
import { initNativeGoogleOAuthReturnHandler } from './oauthMobile';

patchFetchForCapacitor();
initNativeGoogleOAuthReturnHandler();
