import { logWarn } from './logger.js';

/** Background inbox/read-state sync — log only, never show a user-facing error toast. */
export function logBackgroundSyncFailure(label: string, detail?: unknown): void {
  logWarn(`${label} (non-fatal):`, detail);
}

/** Run a non-critical follow-up after the primary user action already succeeded. */
export async function runBackgroundSync(label: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (detail) {
    logBackgroundSyncFailure(label, detail);
  }
}

/** True when we already have listings in memory or cache (failed refresh should stay quiet). */
export function hasCachedVehicleCatalog(): boolean {
  if (typeof localStorage === 'undefined') return false;
  for (const key of ['reRideVehicles_prod', 'reRideVehicles', 'reRideVehicles_dev']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}
