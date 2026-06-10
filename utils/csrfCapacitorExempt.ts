import { isAndroidWebViewAssetLoaderOrigin } from './cors-origin';

/**
 * Origins that may legitimately send `x-app-client: capacitor` (packaged WebView shells).
 * Browser tabs at http://localhost must NOT qualify in production — they could forge the header.
 */
export function isTrustedCapacitorRequestOrigin(originHeader: string | undefined): boolean {
  const isPackagedAndroidWebView = isAndroidWebViewAssetLoaderOrigin(originHeader);
  const isNativeCapacitorOrigin =
    originHeader === 'https://localhost' ||
    originHeader === 'capacitor://localhost' ||
    originHeader === 'ionic://localhost' ||
    isPackagedAndroidWebView;
  const isDevCapacitorOrigin =
    process.env.NODE_ENV !== 'production' &&
    !process.env.VERCEL_ENV &&
    (originHeader === 'https://127.0.0.1' ||
      originHeader === 'http://localhost' ||
      originHeader === 'http://127.0.0.1');
  return isNativeCapacitorOrigin || isDevCapacitorOrigin;
}

export function shouldSkipCsrfForCapacitorNative(
  appClientHeader: string,
  originHeader: string | undefined,
): boolean {
  return appClientHeader.toLowerCase() === 'capacitor' && isTrustedCapacitorRequestOrigin(originHeader);
}
