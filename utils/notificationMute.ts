import type { Notification } from '../types';

const STORAGE_KEY = 'reride_notification_mute_keys';

/** Limits aligned with API PUT /users sanitization. */
export const MAX_NOTIFICATION_MUTE_KEYS = 200;
export const MAX_NOTIFICATION_MUTE_KEY_LENGTH = 200;

export function sanitizeMuteKeysForServer(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.slice(0, MAX_NOTIFICATION_MUTE_KEY_LENGTH))
    .slice(0, MAX_NOTIFICATION_MUTE_KEYS);
}

export function readMuteKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function writeMuteKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
}

/**
 * When the user profile includes `notificationMuteKeys` (including `[]`), that is the source of truth.
 * If the field is absent (e.g. legacy row), fall back to localStorage.
 */
export function getEffectiveMuteKeys(profileMuteKeys: string[] | undefined): Set<string> {
  if (profileMuteKeys !== undefined) {
    return new Set(sanitizeMuteKeysForServer(profileMuteKeys));
  }
  return readMuteKeys();
}

/** Stable key for grouping and muting a "story" (same chat or same listing). */
export function getNotificationStoryKey(n: Notification): string {
  if (n.targetType === 'conversation') {
    return `conv:${String(n.targetId)}`;
  }
  if (
    (n.targetType === 'vehicle' || n.targetType === 'price_drop') &&
    n.vehicleId != null
  ) {
    return `vehicle:${n.vehicleId}`;
  }
  return `story:${n.targetType}:${String(n.targetId)}`;
}

export function isStoryMuted(n: Notification, muted: Set<string>): boolean {
  return muted.has(getNotificationStoryKey(n));
}
