import { isCapacitorNative } from './apiConfig.js';

/**
 * True when running inside Capacitor Android/iOS WebView or a packaged shell
 * (https://localhost, appassets.androidplatform.net). Uses the same detection as
 * API URL rewriting so native storage and fetch behave consistently.
 */
export function isCapacitorNativeApp(): boolean {
  return isCapacitorNative();
}
