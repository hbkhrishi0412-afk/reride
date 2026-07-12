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

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

/** Industry-standard short durations: success/info brief, errors linger. */
export const TOAST_DURATION_MS: Record<ToastKind, number> = {
  success: 2800,
  info: 3200,
  warning: 4200,
  error: 5500,
};

export const MAX_VISIBLE_TOASTS = 3;
export const DUPLICATE_WINDOW_MS = 2500;

export function normalizeToastDedupeKey(message: string, type: ToastKind): string {
  return `${type}:${message.trim().toLowerCase()}`;
}

/** Skip inbound message toasts when the user is already in that thread. */
export function shouldShowInboundMessageToast(
  conversationId: string,
  activeChatId?: string | null,
): boolean {
  if (!conversationId) return false;
  if (activeChatId && String(activeChatId) === String(conversationId)) {
    return false;
  }
  return true;
}

let offlineToastShownThisSession = false;

export function shouldShowOfflineToast(): boolean {
  if (offlineToastShownThisSession) return false;
  offlineToastShownThisSession = true;
  return true;
}

export function resetOfflineToastSession(): void {
  offlineToastShownThisSession = false;
}
