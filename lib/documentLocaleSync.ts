/**
 * Keeps document root + SEO-related tags aligned with the active i18n language:
 *   - <html lang="...">
 *   - <title> and parallel meta tags (description, og:*, twitter:*)
 *
 * React-Helmet always emits English strings from <SEO />. When the user picks
 * Hindi / Telugu / Tamil, we translate those baselines once (cached in the same
 * store as dynamicTranslate) and mirror the result across common meta tags.
 *
 * When the user returns to English, we restore the last captured English
 * baseline from Helmet (not a machine translation back to English).
 */
import type { i18n as I18nInstance } from 'i18next';
import {
  translateText,
  getCachedTranslation,
  isAutoTranslatableLanguage,
} from './dynamicTranslate';

const HTML_LANG = new Set(['en', 'hi', 'te', 'ta']);

/** Rough English detector — avoids treating Hindi titles as new baselines. */
function looksLikeEnglish(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return false;
  if (/[\u0900-\u0D7F\u0B80-\u0BFF]/.test(t)) return false;
  return /[A-Za-z]{2,}/.test(t);
}

function readMeta(nameOrSelector: string, attr = 'content'): string {
  const el = document.querySelector(nameOrSelector);
  return el?.getAttribute(attr) ?? '';
}

function writeMeta(selector: string, value: string): void {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', value);
}

function syncHtmlLang(i18n: I18nInstance): void {
  const raw = i18n.resolvedLanguage || i18n.language || 'en';
  const base = raw.split('-')[0].toLowerCase();
  document.documentElement.lang = HTML_LANG.has(base) ? base : 'en';
}

export function installDocumentLocaleSync(i18n: I18nInstance): void {
  if (typeof document === 'undefined') return;

  let baselineTitleEn = '';
  let baselineDescEn = '';
  /** True while we overwrite title/meta from our own overlay (skip observer noise). */
  let applyingOverlay = false;

  const captureBaselinesIfEnglish = (): void => {
    const t = document.title;
    if (looksLikeEnglish(t)) baselineTitleEn = t;
    const d = readMeta('meta[name="description"]');
    if (looksLikeEnglish(d)) baselineDescEn = d;
  };

  const applyEnglishDOM = (): void => {
    applyingOverlay = true;
    if (baselineTitleEn) {
      document.title = baselineTitleEn;
      writeMeta('meta[property="og:title"]', baselineTitleEn);
      writeMeta('meta[name="twitter:title"]', baselineTitleEn);
    }
    if (baselineDescEn) {
      writeMeta('meta[name="description"]', baselineDescEn);
      writeMeta('meta[property="og:description"]', baselineDescEn);
      writeMeta('meta[name="twitter:description"]', baselineDescEn);
    }
    applyingOverlay = false;
  };

  const applyLocalizedDOM = async (): Promise<void> => {
    const raw = i18n.resolvedLanguage || i18n.language || 'en';
    const langSnap = raw.split('-')[0].toLowerCase();
    if (!isAutoTranslatableLanguage(langSnap)) {
      applyEnglishDOM();
      return;
    }
    if (!baselineTitleEn && !baselineDescEn) captureBaselinesIfEnglish();
    if (!baselineTitleEn && !baselineDescEn) return;

    applyingOverlay = true;
    try {
      if (baselineTitleEn) {
        const hit = getCachedTranslation(baselineTitleEn, langSnap);
        const trTitle = hit ?? (await translateText(baselineTitleEn, langSnap));
        const active = (i18n.resolvedLanguage || i18n.language || 'en')
          .split('-')[0]
          .toLowerCase();
        if (active !== langSnap || !isAutoTranslatableLanguage(active)) return;
        document.title = trTitle;
        writeMeta('meta[property="og:title"]', trTitle);
        writeMeta('meta[name="twitter:title"]', trTitle);
      }
      if (baselineDescEn) {
        const hitD = getCachedTranslation(baselineDescEn, langSnap);
        const trDesc = hitD ?? (await translateText(baselineDescEn, langSnap));
        const active = (i18n.resolvedLanguage || i18n.language || 'en')
          .split('-')[0]
          .toLowerCase();
        if (active !== langSnap || !isAutoTranslatableLanguage(active)) return;
        writeMeta('meta[name="description"]', trDesc);
        writeMeta('meta[property="og:description"]', trDesc);
        writeMeta('meta[name="twitter:description"]', trDesc);
      }
    } finally {
      applyingOverlay = false;
    }
  };

  const scheduleSync = (): void => {
    syncHtmlLang(i18n);
    const raw = i18n.resolvedLanguage || i18n.language || 'en';
    const lang = raw.split('-')[0].toLowerCase();
    if (!isAutoTranslatableLanguage(lang)) {
      if (!baselineTitleEn && !baselineDescEn) captureBaselinesIfEnglish();
      applyEnglishDOM();
      return;
    }
    void applyLocalizedDOM();
  };

  let headDebounce: ReturnType<typeof setTimeout> | null = null;
  const onHeadMutated = (): void => {
    if (applyingOverlay) return;
    if (headDebounce) return;
    headDebounce = setTimeout(() => {
      headDebounce = null;
      captureBaselinesIfEnglish();
      scheduleSync();
    }, 80);
  };

  i18n.on('languageChanged', scheduleSync);

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        captureBaselinesIfEnglish();
        scheduleSync();
      },
      { once: true }
    );
  } else {
    captureBaselinesIfEnglish();
    scheduleSync();
  }

  const head = document.head;
  if (head) {
    const mo = new MutationObserver(onHeadMutated);
    mo.observe(head, { subtree: true, childList: true, characterData: true, attributes: true });
  }
}
