import { isCapacitorNativeApp } from './isCapacitorNative';

/**
 * Web: navigator.geolocation with low-accuracy first, then high-accuracy retry.
 * Native (Capacitor): @capacitor/geolocation so Android/iOS can request runtime
 * permission and use GPS. The WebView geolocation API often returns PERMISSION_DENIED
 * unless AndroidManifest includes location permissions and the app uses the native API.
 */

function geoTimeoutError(): GeolocationPositionError {
  return { code: 3, message: 'Timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

/** Short inner timeouts — long hangs feel broken on Android WebView / emulators; modal falls back to manual pick. */
const webGetCurrentPositionWithFallback = (): Promise<GeolocationPosition> => {
  const opts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 },
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

async function getCurrentPositionUnifiedInner(): Promise<GeolocationPosition> {
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
        timeout: 12000,
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

/** Hard upper bound so UI never waits indefinitely (permission + GPS + plugin quirks). */
const HARD_GEO_CAP_MS = 22000;

export async function getCurrentPositionUnified(): Promise<GeolocationPosition> {
  if (typeof window === 'undefined') {
    return getCurrentPositionUnifiedInner();
  }
  return new Promise((resolve, reject) => {
    const tid = window.setTimeout(() => reject(geoTimeoutError()), HARD_GEO_CAP_MS);
    getCurrentPositionUnifiedInner()
      .then((pos) => {
        window.clearTimeout(tid);
        resolve(pos);
      })
      .catch((err) => {
        window.clearTimeout(tid);
        reject(err);
      });
  });
}
