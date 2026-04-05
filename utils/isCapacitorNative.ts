/** True when running inside Capacitor Android/iOS WebView (not mobile browser PWA). */
export function isCapacitorNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const C = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return C?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
