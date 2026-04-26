import type { Notification } from '../types';

/**
 * Data we actually persist: allowlisted fields only. Never pass through
 * `metadata` or other API row fields (may embed request bodies / PII).
 * Built from `unknown` via toSessionStoredFromUnknown so static analysis
 * does not treat this as tainted user-session data in clear text.
 */
type SessionStoredNotification = {
  id: number;
  recipientEmail: string;
  message: string;
  title?: string;
  targetId: string | number;
  vehicleId?: number;
  targetType: Notification['targetType'];
  type?: string;
  isRead: boolean;
  timestamp: string;
};

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function asNonEmptyString(x: unknown): string | undefined {
  if (x == null) return undefined;
  const s = String(x);
  return s;
}

function parseFiniteId(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseTargetTypeLabel(x: unknown): string | undefined {
  const s = asNonEmptyString(x);
  return s;
}

function parseTargetType(s: unknown): Notification['targetType'] {
  const t = (parseTargetTypeLabel(s) || '').toLowerCase();
  if (t === 'vehicle') return 'vehicle';
  if (t === 'conversation') return 'conversation';
  if (t === 'price_drop' || t === 'pricedrop') return 'price_drop';
  if (t === 'insurance_expiry' || t === 'insurance expiry') return 'insurance_expiry';
  if (t === 'general' || t === 'general_admin' || t === 'admin') return 'general_admin';
  return 'general_admin';
}

function parseTargetId(o: Record<string, unknown>): string | number {
  const direct = o.targetId;
  if (typeof direct === 'string' || typeof direct === 'number') return direct;
  const meta = o.metadata;
  if (isPlainObject(meta)) {
    const t = meta.targetId;
    if (typeof t === 'string' || typeof t === 'number') return t;
  }
  return parseFiniteId(o.id) ?? '';
}

function parseVehicleId(o: Record<string, unknown>): number | undefined {
  const v = o.vehicleId;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  const meta = o.metadata;
  if (isPlainObject(meta) && meta.vehicleId != null) {
    return parseVehicleId({ vehicleId: meta.vehicleId } as Record<string, unknown>);
  }
  return undefined;
}

function parseIsRead(o: Record<string, unknown>): boolean {
  if (o.isRead === true || o.isRead === false) return o.isRead;
  if (o.read === true || o.read === false) return o.read;
  if (o.is_read === true || o.is_read === false) return o.is_read;
  return false;
}

function parseTimestamp(o: Record<string, unknown>): string {
  const t = o.timestamp ?? o.created_at ?? o.updated_at;
  if (t != null) {
    const s = String(t);
    if (s.length > 0) return s;
  }
  return new Date().toISOString();
}

/** Generic copy only — no user email or free-text body. */
function safePersistedMessage(
  type: string | undefined,
  targetType: Notification['targetType'],
): string {
  if (type === 'service_request_status') {
    return 'Service request update';
  }
  if (targetType === 'price_drop' || type === 'price_drop') {
    return 'Price drop alert';
  }
  if (targetType === 'conversation') {
    return 'Conversation update';
  }
  if (targetType === 'vehicle') {
    return 'Listing update';
  }
  return 'Notification';
}

function safePersistedTitle(title: string | undefined): string | undefined {
  if (title === 'Price drop' || title === 'Service Request Update') {
    return title;
  }
  return undefined;
}

/**
 * Rebuild one notification for storage from an untrusted/unknown value (API row, parsed JSON, etc.).
 * This is a deliberate sanitizer / barrier for clear-text web storage and static analysis.
 */
function toSessionStoredFromUnknown(raw: unknown): SessionStoredNotification | null {
  if (!isPlainObject(raw)) return null;
  const o = raw;
  const id = parseFiniteId(o.id);
  if (id == null) return null;

  const typeStr = o.type == null ? undefined : String(o.type);
  const targetTypeLabel = parseTargetTypeLabel(o.targetType) ?? typeStr;
  const targetType = parseTargetType(targetTypeLabel ?? typeStr);

  const titleRaw = o.title == null ? undefined : String(o.title);
  const message = safePersistedMessage(typeStr, targetType);
  const title = safePersistedTitle(titleRaw);

  return {
    id,
    recipientEmail: '',
    message,
    title,
    targetId: parseTargetId(o),
    vehicleId: parseVehicleId(o),
    targetType,
    type: typeStr,
    isRead: parseIsRead(o),
    timestamp: parseTimestamp(o),
  };
}

/**
 * Shape safe for localStorage: no recipient email and no original message/title free text.
 * Accepts `unknown[]` so callers are not required to pre-narrow; each element is allowlisted.
 */
export function notificationsForLocalStorage(list: ReadonlyArray<unknown>): Notification[] {
  const out: SessionStoredNotification[] = [];
  for (const item of list) {
    const one = toSessionStoredFromUnknown(item);
    if (one) out.push(one);
  }
  return out as Notification[];
}

const NOTIFICATIONS_KEY_V2 = 'reRideNotificationsV2';
const NOTIFICATIONS_KEY_LEGACY = 'reRideNotifications';

/**
 * Sanitized list only in sessionStorage (shorter lived than localStorage; avoids long-lived clear-text PII on disk).
 */
export function persistReRideNotifications(list: ReadonlyArray<unknown>): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const safe = notificationsForLocalStorage(list);
    sessionStorage.setItem(NOTIFICATIONS_KEY_V2, JSON.stringify(safe));
    try {
      localStorage.removeItem(NOTIFICATIONS_KEY_LEGACY);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedReRideNotifications(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem(NOTIFICATIONS_KEY_V2);
      if (s) return s;
    }
    if (typeof localStorage !== 'undefined') {
      const l = localStorage.getItem(NOTIFICATIONS_KEY_LEGACY);
      if (l) {
        try {
          if (typeof sessionStorage !== 'undefined') {
            const parsed: unknown = JSON.parse(l);
            const arr = Array.isArray(parsed) ? parsed : null;
            if (arr) {
              const safe = notificationsForLocalStorage(arr);
              sessionStorage.setItem(NOTIFICATIONS_KEY_V2, JSON.stringify(safe));
              localStorage.removeItem(NOTIFICATIONS_KEY_LEGACY);
              return sessionStorage.getItem(NOTIFICATIONS_KEY_V2);
            }
          }
        } catch {
          return l;
        }
        return l;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
