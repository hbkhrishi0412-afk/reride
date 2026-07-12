import { isCapacitorNativeApp } from './isCapacitorNative.js';

/**
 * Web: navigator.geolocation with low-accuracy first, then high-accuracy retry.
 * Native (Capacitor): @capacitor/geolocation so Android/iOS can request runtime
 * permission and use GPS. The WebView geolocation API often returns PERMISSION_DENIED
 * unless AndroidManifest includes location permissions and the app uses the native API.
 */

function geoTimeoutError(): GeolocationPositionError {
  return { code: 3, message: 'Timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

function deniedError(): GeolocationPositionError {
  return { code: 1, message: 'User denied Geolocation' } as GeolocationPositionError;
}

function normalizeGeoError(err: unknown): GeolocationPositionError | null {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as GeolocationPositionError).code;
    if (typeof code === 'number') return err as GeolocationPositionError;
  }
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message)
      : String(err ?? '');
  const lower = msg.toLowerCase();
  if (lower.includes('denied') || lower.includes('permission')) {
    return deniedError();
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return geoTimeoutError();
  }
  if (lower.includes('unavailable') || lower.includes('disabled')) {
    return { code: 2, message: msg } as GeolocationPositionError;
  }
  return null;
}

function asGeolocationPosition(pos: unknown): GeolocationPosition {
  const p = pos as { coords?: { latitude?: number; longitude?: number } } | null;
  const lat = p?.coords?.latitude;
  const lng = p?.coords?.longitude;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return pos as GeolocationPosition;
  }
  throw new Error('invalid-position');
}

/** Short inner timeouts — long hangs feel broken on Android WebView / emulators. */
const webGetCurrentPositionWithFallback = (): Promise<GeolocationPosition> => {
  const opts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
  ];
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('no-geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => {
        const normalized = normalizeGeoError(err) ?? err;
        reject(normalized);
      },
      opts[0]!,
    );
  }).catch((err: unknown) => {
    const ge = normalizeGeoError(err);
    const code = ge?.code ?? -1;
    if (code === 2 || code === 3) {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (retryErr) => reject(normalizeGeoError(retryErr) ?? retryErr),
          opts[1]!,
        );
      });
    }
    return Promise.reject(ge ?? err);
  });
};

async function ensureCapacitorLocationPermission(
  Geolocation: typeof import('@capacitor/geolocation').Geolocation,
): Promise<void> {
  let perm = await Geolocation.checkPermissions();
  if (perm.location === 'granted') return;

  if (perm.location === 'denied') {
    throw deniedError();
  }

  perm = await Promise.race([
    Geolocation.requestPermissions(),
    new Promise<Awaited<ReturnType<typeof Geolocation.checkPermissions>>>((_, reject) => {
      window.setTimeout(() => reject(geoTimeoutError()), 12_000);
    }),
  ]);
  if (perm.location !== 'granted') {
    throw deniedError();
  }
}

async function getCapacitorPosition(): Promise<GeolocationPosition> {
  const { Geolocation } = await import('@capacitor/geolocation');
  await ensureCapacitorLocationPermission(Geolocation);

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  ];

  let lastError: unknown;
  for (const options of attempts) {
    try {
      const pos = await Geolocation.getCurrentPosition(options);
      return asGeolocationPosition(pos);
    } catch (e) {
      lastError = e;
      const normalized = normalizeGeoError(e);
      if (normalized?.code === 1) throw normalized;
    }
  }

  throw normalizeGeoError(lastError) ?? lastError ?? geoTimeoutError();
}

async function getCurrentPositionUnifiedInner(): Promise<GeolocationPosition> {
  if (isCapacitorNativeApp()) {
    try {
      return await getCapacitorPosition();
    } catch (e) {
      const normalized = normalizeGeoError(e);
      if (normalized?.code === 1) {
        throw normalized;
      }
      // fall through: try WebView geolocation (e.g. plugin hiccup on emulator)
    }
  }
  return webGetCurrentPositionWithFallback();
}

/** Hard upper bound so UI never waits indefinitely (permission + GPS + plugin quirks). */
const HARD_GEO_CAP_MS = 25000;

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
        reject(normalizeGeoError(err) ?? err);
      });
  });
}
