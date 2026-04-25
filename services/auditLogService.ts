import type { AuditLogEntry } from '../types';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

const AUDIT_LOG_STORAGE_KEY = 'reRideAuditLog';
const MAX_LOCAL_ENTRIES = 200;

export const getAuditLog = (): AuditLogEntry[] => {
  try {
    if (typeof window === 'undefined') return [];
    const logJson =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUDIT_LOG_STORAGE_KEY) : null;
    return logJson ? JSON.parse(logJson) : [];
  } catch (error) {
    console.error('Failed to parse audit log from sessionStorage', error);
    return [];
  }
};

export const saveAuditLog = (log: AuditLogEntry[]) => {
  try {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    // Do not persist free-text `details` locally; API mirror still gets full entry via persistAuditEntry.
    const withoutDetails = log.slice(0, MAX_LOCAL_ENTRIES).map(({ details: _d, ...rest }) => rest);
    sessionStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(withoutDetails));
  } catch (error) {
    console.error('Failed to save audit log to sessionStorage', error);
  }
};

// ---------------------------------------------------------------------------
// Unique ID generator — Date.now() can collide when several entries are
// created inside the same millisecond (e.g. during an admin save that logs
// several field updates back-to-back). The audit_log table uses `id` as the
// PK, so collisions would cause the upsert to merge rows. We bump the
// counter monotonically to guarantee uniqueness within the session.
// ---------------------------------------------------------------------------
let lastGeneratedId = 0;
const nextId = (): number => {
  const now = Date.now();
  const candidate = now > lastGeneratedId ? now : lastGeneratedId + 1;
  lastGeneratedId = candidate;
  return candidate;
};

/**
 * Build an AuditLogEntry and persist it locally.
 *
 * Callers should also fire-and-forget `persistAuditEntry(entry)` to mirror
 * the event to the Supabase-backed API — AppProvider does this inside its
 * `setAuditLog(prev => [entry, ...prev])` callbacks.
 */
export const logAction = (actor: string, action: string, target: string, details?: string): AuditLogEntry => {
    const newLogEntry: AuditLogEntry = {
        id: nextId(),
        timestamp: new Date().toISOString(),
        actor,
        action,
        target,
        details,
    };

    const currentLog = getAuditLog();
    const updatedLog = [newLogEntry, ...currentLog].slice(0, MAX_LOCAL_ENTRIES);
    saveAuditLog(updatedLog);

    // Fire-and-forget API mirror so individual call sites don't need to await.
    void persistAuditEntry(newLogEntry);

    return newLogEntry;
};

interface ApiAuditResponse {
  success?: boolean;
  entries?: AuditLogEntry[];
  inserted?: number;
  reason?: string;
  error?: string;
}

/**
 * Fetch the most recent audit entries from the API. Returns an empty array on
 * failure so the caller can fall back to the localStorage copy.
 */
export const fetchAuditLog = async (limit = 500): Promise<AuditLogEntry[]> => {
  try {
    const response = await authenticatedFetch(
      `/api/audit-log?limit=${encodeURIComponent(String(limit))}`,
      { method: 'GET' },
    );
    const parsed = await handleApiResponse<ApiAuditResponse>(response);
    if (!response.ok || parsed.success === false) {
      throw new Error(parsed.reason || parsed.error || `Failed to fetch audit log (${response.status})`);
    }
    const entries = Array.isArray(parsed.data?.entries) ? parsed.data!.entries! : [];
    if (entries.length > 0) {
      // Keep the persisted copy seeded with the canonical server list so
      // offline loads still render recent activity.
      saveAuditLog(entries);
    }
    return entries;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to fetch audit log from API, using local cache:', error);
    }
    return [];
  }
};

/**
 * Persist a single audit entry (or batch) to the API. Non-admin callers and
 * unauthenticated sessions will 401/403 — we swallow errors silently so they
 * don't disrupt the user-facing mutation that triggered the log.
 */
export const persistAuditEntry = async (
  entry: AuditLogEntry | AuditLogEntry[],
): Promise<void> => {
  try {
    const body = Array.isArray(entry) ? { entries: entry } : entry;
    await authenticatedFetch('/api/audit-log', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to persist audit entry to API (kept local copy):', error);
    }
  }
};
