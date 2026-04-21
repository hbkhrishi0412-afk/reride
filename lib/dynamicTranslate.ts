/**
 * Dynamic translation engine used by:
 *   1. i18next missing-key handler (keys added in English auto-fill other languages).
 *   2. DOM auto-translator (hardcoded English strings in components auto-translate live).
 *
 * Design goals:
 *  - No API key, no backend, no cost (uses Google Translate's public endpoint).
 *  - Preserve i18next placeholders like {{name}}, {{count}} during translation.
 *  - Single shared localStorage cache — translate each English string once, ever.
 *  - Batch bursts of requests (≤ ~3500 chars per HTTP call).
 *  - Deduplicate identical inflight requests for the same text.
 *  - Fail silently: fallback is simply English (i18next's fallbackLng).
 */
import type { i18n as I18nInstance } from 'i18next';

const CACHE_KEY = 'reride:dyn-i18n-cache:v1';
const SUPPORTED_TARGETS = new Set(['hi', 'te', 'ta']);
const BATCH_FLUSH_MS = 140;
/** Keep batches small — Google Translate uses GET; long `q=` URLs hit browser/proxy limits. */
const MAX_BATCH_CHARS = 1200;
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;
const JOINER = '\n\n@@@===@@@\n\n';

type LangCache = Record<string, string>;
type Cache = Record<string, LangCache>;

interface PendingItem {
  text: string;
  preparedText: string;
  placeholders: string[];
  resolve: (translated: string) => void;
}

const cache: Cache = loadCache();
const inflight = new Map<string, Promise<string>>();
const queues: Record<string, PendingItem[]> = {};
const flushTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};

function loadCache(): Cache {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}

let savePending = false;
function saveCacheDebounced(): void {
  if (typeof window === 'undefined' || savePending) return;
  savePending = true;
  setTimeout(() => {
    savePending = false;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Quota or private mode — ignore.
    }
  }, 300);
}

function normalizeLang(raw: string | undefined | null): string {
  return String(raw || 'en').split('-')[0].toLowerCase();
}

function extractPlaceholders(text: string): {
  preparedText: string;
  placeholders: string[];
} {
  const placeholders: string[] = [];
  const preparedText = text.replace(PLACEHOLDER_RE, (match) => {
    placeholders.push(match);
    return `__PH${placeholders.length - 1}__`;
  });
  return { preparedText, placeholders };
}

function restorePlaceholders(translated: string, placeholders: string[]): string {
  return translated.replace(/__PH(\d+)__/gi, (_, idx) =>
    placeholders[Number(idx)] ?? ''
  );
}

async function callTranslateApi(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  const joined = texts.join(JOINER);
  const encoded = encodeURIComponent(joined);
  if (encoded.length > 7500) {
    throw new Error('translate: batch too large for GET — reduce MAX_BATCH_CHARS');
  }
  const url =
    'https://translate.googleapis.com/translate_a/single' +
    `?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}` +
    `&dt=t&q=${encoded}`;

  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) throw new Error(`translate http ${resp.status}`);
  const data = (await resp.json()) as unknown;

  if (!Array.isArray(data) || !Array.isArray((data as unknown[])[0])) {
    throw new Error('translate: unexpected response shape');
  }
  const segments = (data as unknown[])[0] as unknown[];
  const fullText = segments
    .map((seg) => (Array.isArray(seg) ? String(seg[0] ?? '') : ''))
    .join('');

  const parts = fullText.split(JOINER);
  if (parts.length !== texts.length) {
    if (texts.length === 1) return [fullText];
    throw new Error('translate: delimiter split mismatch');
  }
  return parts;
}

async function flushQueue(targetLang: string): Promise<void> {
  const queue = queues[targetLang];
  if (!queue || queue.length === 0) return;
  queues[targetLang] = [];

  const batches: PendingItem[][] = [];
  let current: PendingItem[] = [];
  let currentChars = 0;
  for (const item of queue) {
    const len = item.preparedText.length + JOINER.length;
    if (currentChars + len > MAX_BATCH_CHARS && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += len;
  }
  if (current.length > 0) batches.push(current);

  const langCache = (cache[targetLang] ||= {});

  for (const batch of batches) {
    try {
      const translated = await callTranslateApi(
        batch.map((b) => b.preparedText),
        targetLang
      );
      translated.forEach((raw, i) => {
        const item = batch[i];
        if (!item) return;
        const finalText = raw
          ? restorePlaceholders(raw, item.placeholders).trim()
          : '';
        const value = finalText && finalText !== item.text ? finalText : item.text;
        if (finalText && finalText !== item.text) {
          langCache[item.text] = finalText;
        }
        item.resolve(value);
      });
      saveCacheDebounced();
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[dyn-i18n] batch translate failed', err);
      }
      for (const item of batch) item.resolve(item.text);
    }
  }
}

function scheduleFlush(targetLang: string): void {
  if (flushTimers[targetLang]) return;
  flushTimers[targetLang] = setTimeout(() => {
    flushTimers[targetLang] = null;
    const key = `${targetLang}:flush`;
    if (inflight.has(key)) return;
    const p = flushQueue(targetLang).then(() => '').finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, p);
  }, BATCH_FLUSH_MS);
}

/**
 * Public: translate one English string to the target language.
 * Returns the original text if the target is unsupported or on failure.
 * Synchronously resolved when cached.
 */
export function translateText(
  text: string,
  targetLangRaw: string
): Promise<string> {
  if (!text) return Promise.resolve(text);
  const lang = normalizeLang(targetLangRaw);
  if (!SUPPORTED_TARGETS.has(lang)) return Promise.resolve(text);

  const langCache = (cache[lang] ||= {});
  const hit = langCache[text];
  if (hit) return Promise.resolve(hit);

  const dedupKey = `${lang}:${text}`;
  const existing = inflight.get(dedupKey);
  if (existing) return existing;

  const { preparedText, placeholders } = extractPlaceholders(text);
  const promise = new Promise<string>((resolve) => {
    const queue = queues[lang] || (queues[lang] = []);
    queue.push({ text, preparedText, placeholders, resolve });
    scheduleFlush(lang);
  }).finally(() => {
    inflight.delete(dedupKey);
  });

  inflight.set(dedupKey, promise);
  return promise;
}

/**
 * Synchronous cache lookup — returns a translation if we already have one,
 * otherwise undefined. Useful for rendering without an async flicker when
 * the cache is warm.
 */
export function getCachedTranslation(
  text: string,
  targetLangRaw: string
): string | undefined {
  const lang = normalizeLang(targetLangRaw);
  if (!SUPPORTED_TARGETS.has(lang)) return undefined;
  return cache[lang]?.[text];
}

/** Coalesce rapid-fire missingKey events (initial render storms) into one flush per tick. */
const MISSING_BATCH_MS = 120;
type MissingRow = {
  lngs: string[];
  ns: string;
  key: string;
  fallbackValue: string;
};
const pendingMissing = new Map<string, MissingRow>();
let missingFlushTimer: ReturnType<typeof setTimeout> | null = null;

function flushMissingKeys(i18n: I18nInstance): void {
  const batch = Array.from(pendingMissing.values());
  pendingMissing.clear();
  missingFlushTimer = null;

  for (const row of batch) {
    const targets = Array.isArray(row.lngs) ? row.lngs : [row.lngs];
    for (const raw of targets) {
      const lang = normalizeLang(String(raw || ''));
      if (!SUPPORTED_TARGETS.has(lang)) continue;
      if (!row.fallbackValue || typeof row.fallbackValue !== 'string') continue;
      const namespace = row.ns || 'translation';

      void translateText(row.fallbackValue, lang).then((translated) => {
        if (translated && translated !== row.fallbackValue) {
          i18n.addResource(lang, namespace, row.key, translated);
        }
      });
    }
  }
}

function scheduleMissingFlush(i18n: I18nInstance): void {
  if (missingFlushTimer) return;
  missingFlushTimer = setTimeout(() => flushMissingKeys(i18n), MISSING_BATCH_MS);
}

/**
 * Install the i18next missing-key auto-translator.
 */
export function installDynamicTranslation(i18n: I18nInstance): void {
  i18n.on('missingKey', (lngs, ns, key, fallbackValue) => {
    if (!fallbackValue || typeof fallbackValue !== 'string') return;

    const dedupeKey = `${typeof ns === 'string' ? ns : 'translation'}:${key}:${Array.isArray(lngs) ? lngs.join(',') : String(lngs)}`;
    pendingMissing.set(dedupeKey, {
      lngs: Array.isArray(lngs) ? lngs : [lngs],
      ns: typeof ns === 'string' ? ns : 'translation',
      key,
      fallbackValue,
    });
    scheduleMissingFlush(i18n);
  });
}

export function clearDynamicTranslationCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
  for (const k of Object.keys(cache)) delete cache[k];
}

export function isAutoTranslatableLanguage(raw: string | undefined | null): boolean {
  return SUPPORTED_TARGETS.has(normalizeLang(raw));
}
