import { isCapacitorNativeApp } from './isCapacitorNative';

/**
 * Web: navigator.geolocation with low-accuracy first, then high-accuracy retry.
 * Native (Capacitor): @capacitor/geolocation so Android/iOS can request runtime
 * permission and use GPS. The WebView geolocation API often returns PERMISSION_DENIED
 * unless AndroidManifest includes location permissions and the app uses the native API.
 */
const webGetCurrentPositionWithFallback = (): Promise<GeolocationPosition> => {
  const opts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 22000, maximumAge: 120000 },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
  ];
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('no-geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, opts[0]!);
  }).catch((err: unknown) => {
    const ge = err as Partial<GeolocationPositionError> | null;
    const code = typeof ge?.code === 'number' ? ge.code : -1;
    if (code === 2 || code === 3) {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts[1]!);
      });
    }
    return Promise.reject(err);
  });
};

const deniedError = () => {
  const err = { code: 1, message: 'User denied Geolocation' } as GeolocationPositionError;
  return err;
};

export async function getCurrentPositionUnified(): Promise<GeolocationPosition> {
  if (isCapacitorNativeApp()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const checked = await Geolocation.checkPermissions();
      if (checked.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          return Promise.reject(deniedError());
        }
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 30000,
      });
      return pos as unknown as GeolocationPosition;
    } catch (e) {
      const isDenied =
        e &&
        typeof e === 'object' &&
        'message' in e &&
        String((e as { message?: string }).message).toLowerCase().includes('denied');
      if (isDenied) {
        return Promise.reject(deniedError());
      }
      // fall through: try WebView geolocation (e.g. plugin hiccup on emulator)
    }
  }
  return webGetCurrentPositionWithFallback();
}
