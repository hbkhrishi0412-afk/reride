/**
 * Pure helpers extracted from AppProviderCore to shrink the monolith surface.
 */
import { startTransition } from 'react';
import type { ChatMessage, Conversation, Vehicle } from '../../types';
import i18n from '../../lib/i18n';
import { formatSupabaseError } from '../../utils/errorUtils';
import { isCapacitorNative } from '../../utils/apiConfig';
import { getNativeMemoryRefreshToken } from '../../utils/nativeTokenStorage';
import { useHttpOnlyRefreshCookie } from '../../utils/authStorage';
import { sanitizePersistedChatMessage } from '../../services/supabase-conversation-service';

/** PostgREST realtime filter value: quote emails so `@` and special chars parse correctly. */
export function postgrestEqQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** True if we can call refresh-token (native Keychain, JSON refresh, or HttpOnly cookie + persisted user). */
export function hasLikelyRefreshSource(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('reRideRefreshToken')) return true;
    if (isCapacitorNative()) {
      if (getNativeMemoryRefreshToken()) return true;
      if (localStorage.getItem('reRideCurrentUser')) return true;
    }
    if (useHttpOnlyRefreshCookie() && localStorage.getItem('reRideCurrentUser')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Merge local + server messages without duplicates (realtime + optimistic UI).
 * Remote (server) wins when both exist so persisted read-state / payload updates propagate,
 * but locally-only messages (optimistic sends not yet on server) are always kept.
 */
export function mergeConversationMessagesForRealtime(
  local: ChatMessage[],
  remote: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  const remoteIds = new Set<number>();
  for (const m of remote || []) {
    if (m?.id != null) {
      const k = Number(m.id);
      byId.set(k, sanitizePersistedChatMessage(m));
      remoteIds.add(k);
    }
  }
  for (const m of local || []) {
    if (m?.id != null) {
      const k = Number(m.id);
      if (!remoteIds.has(k)) {
        byId.set(k, sanitizePersistedChatMessage(m));
      }
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/** Merge full conversation lists: keep optimistic local messages while absorbing server updates. */
export function mergeConversationLists(
  local: Conversation[],
  remote: Conversation[],
): Conversation[] {
  const remoteMap = new Map<string, Conversation>();
  for (const c of remote) {
    if (c?.id) remoteMap.set(String(c.id), c);
  }

  const merged: Conversation[] = [];
  const seen = new Set<string>();

  for (const rc of remote) {
    if (!rc?.id) continue;
    const key = String(rc.id);
    seen.add(key);
    const lc = local.find((l) => l && String(l.id) === key);
    if (lc) {
      const msgs = mergeConversationMessagesForRealtime(lc.messages || [], rc.messages || []);
      merged.push({ ...rc, messages: msgs });
    } else {
      merged.push(rc);
    }
  }

  for (const lc of local) {
    if (!lc?.id) continue;
    const key = String(lc.id);
    if (!seen.has(key)) {
      merged.push(lc);
    }
  }

  return merged;
}

/** Convert technical errors to actionable user-facing messages. */
export function getUserFriendlyErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    const formatted = formatSupabaseError(error);
    if (formatted !== error.message) {
      return formatted;
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return i18n.t('errors.network');
    }
    if (error.message.includes('timeout')) {
      return i18n.t('errors.timeout');
    }
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return i18n.t('errors.permission');
    }
    return defaultMessage;
  }
  if (typeof error === 'string') {
    return formatSupabaseError(error);
  }
  return defaultMessage;
}

/**
 * Capacitor Android WebView often OOM-kills the renderer when session storage, toast, router,
 * and a heavy first paint (e.g. mobile HOME) run in the same frame right after sign-in.
 * Spread that work across animation frames + a transition update.
 */
export function scheduleCapacitorPostLoginUi(fn: () => void): void {
  if (typeof window === 'undefined' || !isCapacitorNative()) {
    fn();
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        startTransition(fn);
      }, 0);
    });
  });
}

export function isAdminUserRole(role: string | undefined | null): boolean {
  return (role || '').toLowerCase().trim() === 'admin';
}

/** API response structure for vehicle feature operations */
export interface FeatureApiResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
  reason?: string;
  alreadyFeatured?: boolean;
  vehicle?: Vehicle;
  remainingCredits?: number;
}
