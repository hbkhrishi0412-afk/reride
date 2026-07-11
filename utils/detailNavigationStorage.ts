import { View } from '../types.js';

/** Last non-detail screen before opening a listing (HashRouter / WebView can lose `location.state`). */
export const RERIDE_DETAIL_ENTRY_SOURCE_KEY = 'rerideDetailEntrySourceView';

const VIEW_ORDINALS = Object.values(View) as View[];

export function viewToDetailEntryOrdinal(v: View): string {
  const i = VIEW_ORDINALS.indexOf(v);
  return i === -1 ? '0' : String(i);
}

function detailEntryOrdinalToView(ordinal: string): View | undefined {
  if (!/^\d+$/.test(ordinal)) return undefined;
  const i = parseInt(ordinal, 10);
  if (i < 0 || i >= VIEW_ORDINALS.length) return undefined;
  return VIEW_ORDINALS[i];
}

export function readDetailEntrySourceView(): View | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(RERIDE_DETAIL_ENTRY_SOURCE_KEY);
    if (!raw) return undefined;
    if (/^\d+$/.test(raw)) {
      const v = detailEntryOrdinalToView(raw);
      if (v == null || v === View.DETAIL) return undefined;
      return v;
    }
    if (!(Object.values(View) as string[]).includes(raw)) return undefined;
    const v = raw as View;
    return v === View.DETAIL ? undefined : v;
  } catch {
    return undefined;
  }
}

/** Dev-only: POST NDJSON to Vite middleware → `debug-nav.log` in repo root. */
export function agentNavDebugLog(payload: {
  hypothesisId: string;
  message: string;
  location: string;
  runId?: string;
  [key: string]: unknown;
}): void {
  if (typeof import.meta !== 'undefined' && !import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  void fetch('/__debug_nav_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: '4f3bea',
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
}
