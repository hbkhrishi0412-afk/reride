/**
 * DOM auto-translator — production-grade.
 *
 * Walks the rendered DOM and translates ALL visible English text nodes +
 * select attributes (placeholder / title / alt / aria-label) into the
 * active i18next language whenever that language is not English.
 *
 * Works automatically for:
 *  - Hardcoded English strings in any component
 *  - Dynamic data from DB/API (vehicle descriptions, seller bios, city names, etc.)
 *  - Lazy-loaded content, modals, drawers, portals
 *  - Route transitions (SPA navigation)
 *  - Content injected after initial render
 *
 * Uses the shared `translateText` engine (same cache + batching as the
 * i18next missing-key handler), so the first Hindi/Telugu/Tamil visit
 * populates the cache and every later visit is instant and offline-safe.
 *
 * Opt out per-element by adding `data-no-translate` anywhere on a parent.
 */
import type { i18n as I18nInstance } from 'i18next';
import {
  translateText,
  getCachedTranslation,
  isAutoTranslatableLanguage,
} from './dynamicTranslate.js';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'SVG',
  'PATH',
  'CIRCLE',
  'RECT',
  'LINE',
  'POLYGON',
  'POLYLINE',
  'G',
  'USE',
  'DEFS',
  'SYMBOL',
  'CANVAS',
  'IFRAME',
  'OBJECT',
  'VIDEO',
  'AUDIO',
  'HEAD',
  'META',
  'LINK',
  'TITLE',
  'TEMPLATE',
]);

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'alt', 'aria-label'] as const;

const ORIGINAL_TEXT = new WeakMap<Text, string>();
const ORIGINAL_ATTR = new WeakMap<Element, Record<string, string>>();
const TRANSLATING_NODES = new WeakSet<Text>();
const ATTR_WRITING = new WeakMap<Element, Set<string>>();

const translatedTextNodes = new Set<Text>();
const translatedAttrElements = new Set<Element>();

let currentLang = 'en';
let observer: MutationObserver | null = null;
let scanQueued = false;
let installedI18n: I18nInstance | null = null;

/** Multi-pass scan timers — cleared on language switch to avoid stale scans. */
let pendingScanTimers: ReturnType<typeof setTimeout>[] = [];

/**
 * Listeners notified after every language change completes (restore + rescan).
 * Used by the React provider to force component re-renders.
 */
type LangChangeListener = (lang: string) => void;
const langChangeListeners = new Set<LangChangeListener>();

export function onLanguageApplied(fn: LangChangeListener): () => void {
  langChangeListeners.add(fn);
  return () => { langChangeListeners.delete(fn); };
}

function shouldSkipElement(el: Element | null | undefined): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest?.('[data-no-translate]')) return true;
  return false;
}

function shouldRejectTextInControl(parent: Element | null | undefined): boolean {
  if (!parent) return true;
  const tag = parent.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  return false;
}

function markAttrWriting(el: Element, attr: string, active: boolean): void {
  let s = ATTR_WRITING.get(el);
  if (!s) {
    if (!active) return;
    s = new Set();
    ATTR_WRITING.set(el, s);
  }
  if (active) s.add(attr);
  else {
    s.delete(attr);
    if (s.size === 0) ATTR_WRITING.delete(el);
  }
}

const LATIN_WORD_RE = /[A-Za-z]{2,}/;
const NON_LATIN_LETTER_RE = /[\p{Script=Devanagari}\p{Script=Telugu}\p{Script=Tamil}]/u;

function looksLikeEnglish(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2) return false;
  if (NON_LATIN_LETTER_RE.test(s)) return false;
  if (!LATIN_WORD_RE.test(s)) return false;
  return true;
}

function translateTextNode(node: Text): void {
  if (TRANSLATING_NODES.has(node)) return;
  const parent = node.parentElement;
  if (shouldSkipElement(parent)) return;
  if (shouldRejectTextInControl(parent)) return;

  const raw = node.nodeValue;
  if (!raw) return;

  const original = ORIGINAL_TEXT.get(node) || raw;
  if (!looksLikeEnglish(original)) return;

  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  const core = original.slice(leading.length, original.length - trailing.length);
  if (!core) return;

  const langSnapshot = currentLang;

  const cached = getCachedTranslation(core, langSnapshot);
  if (cached) {
    const next = leading + cached + trailing;
    if (node.nodeValue !== next) {
      TRANSLATING_NODES.add(node);
      node.nodeValue = next;
      TRANSLATING_NODES.delete(node);
    }
    ORIGINAL_TEXT.set(node, original);
    translatedTextNodes.add(node);
    return;
  }

  ORIGINAL_TEXT.set(node, original);
  translatedTextNodes.add(node);
  void translateText(core, langSnapshot).then((translated) => {
    if (!translated || translated === core) return;
    // If the node text changed since we started (React update), check if
    // the current value is still the original English — only then overwrite.
    const cur = node.nodeValue;
    if (cur !== original && cur !== (leading + core + trailing)) return;
    if (currentLang !== langSnapshot || currentLang === 'en') return;
    TRANSLATING_NODES.add(node);
    node.nodeValue = leading + translated + trailing;
    TRANSLATING_NODES.delete(node);
  });
}

function translateAttribute(el: Element, attr: string): void {
  if (ATTR_WRITING.get(el)?.has(attr)) return;

  const raw = el.getAttribute(attr);
  if (!raw) return;
  const originals = ORIGINAL_ATTR.get(el) || {};
  const baseline = originals[attr];
  const original = baseline ?? raw;

  if (baseline) {
    const cached = getCachedTranslation(baseline, currentLang);
    if (cached && raw === cached) return;
  }

  if (!looksLikeEnglish(original)) return;

  const langSnapshot = currentLang;

  const cached = getCachedTranslation(original, langSnapshot);
  if (cached) {
    if (raw !== cached) {
      markAttrWriting(el, attr, true);
      el.setAttribute(attr, cached);
      markAttrWriting(el, attr, false);
    }
    originals[attr] = original;
    ORIGINAL_ATTR.set(el, originals);
    translatedAttrElements.add(el);
    return;
  }

  originals[attr] = original;
  ORIGINAL_ATTR.set(el, originals);
  translatedAttrElements.add(el);

  void translateText(original, langSnapshot).then((translated) => {
    if (!translated || translated === original) return;
    if (currentLang !== langSnapshot || currentLang === 'en') return;
    if (el.getAttribute(attr) !== original && el.getAttribute(attr) !== raw) return;
    markAttrWriting(el, attr, true);
    el.setAttribute(attr, translated);
    markAttrWriting(el, attr, false);
  });
}

function walkElementAttributes(el: Element): void {
  if (shouldSkipElement(el)) return;
  for (const attr of TRANSLATABLE_ATTRS) {
    if (el.hasAttribute(attr)) translateAttribute(el, attr);
  }
}

function walkSubtree(root: Node): void {
  if (currentLang === 'en') return;

  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    if (shouldSkipElement(el)) return;
    walkElementAttributes(el);
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(n) {
        if (n.nodeType === Node.TEXT_NODE) {
          const parent = (n as Text).parentElement;
          if (shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
          if (shouldRejectTextInControl(parent)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        const el = n as Element;
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let n: Node | null = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      translateTextNode(n as Text);
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      walkElementAttributes(n as Element);
    }
    n = walker.nextNode();
  }
}

function doFullScan(): void {
  scanQueued = false;
  if (currentLang === 'en') return;
  walkSubtree(document.body);
}

function scheduleFullScan(): void {
  if (scanQueued) return;
  scanQueued = true;
  if (typeof (window as unknown as { requestIdleCallback?: unknown })
    .requestIdleCallback === 'function') {
    (
      window as unknown as {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
      }
    ).requestIdleCallback(doFullScan, { timeout: 300 });
  } else {
    setTimeout(doFullScan, 30);
  }
}

/**
 * Schedule multiple DOM scans at staggered intervals to catch:
 * 1. Content rendered immediately after language change
 * 2. Lazy-loaded components / code-split chunks
 * 3. Async data fetches that resolve after the initial render
 * 4. Animations / transitions revealing new content
 */
function scheduleMultiPassScan(targetLang: string): void {
  cancelPendingScans();

  const passes = [50, 200, 600, 1500, 3500];
  for (const delay of passes) {
    const timer = setTimeout(() => {
      if (currentLang !== targetLang || currentLang === 'en') return;
      scanQueued = false;
      doFullScan();
    }, delay);
    pendingScanTimers.push(timer);
  }
}

function cancelPendingScans(): void {
  for (const t of pendingScanTimers) clearTimeout(t);
  pendingScanTimers = [];
  scanQueued = false;
}

function onMutations(mutations: MutationRecord[]): void {
  if (currentLang === 'en') return;
  let needsScan = false;
  for (const m of mutations) {
    if (m.type === 'characterData') {
      const t = m.target;
      if (t.nodeType === Node.TEXT_NODE && !TRANSLATING_NODES.has(t as Text)) {
        ORIGINAL_TEXT.delete(t as Text);
        translateTextNode(t as Text);
      }
      continue;
    }
    if (m.type === 'attributes') {
      const el = m.target as Element;
      const attr = m.attributeName;
      if (!attr || !TRANSLATABLE_ATTRS.includes(attr as typeof TRANSLATABLE_ATTRS[number])) continue;
      if (ATTR_WRITING.get(el)?.has(attr)) continue;
      const prior = ORIGINAL_ATTR.get(el);
      if (prior) delete prior[attr];
      translateAttribute(el, attr);
      continue;
    }
    if (m.type === 'childList') {
      for (const node of Array.from(m.addedNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          translateTextNode(node as Text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          needsScan = true;
          walkSubtree(node);
        }
      }
    }
  }
  // After a batch of mutations, schedule a follow-up scan to catch any
  // React concurrent mode deferred updates or portal content.
  if (needsScan) scheduleFullScan();
}

function startObserver(): void {
  if (observer || typeof document === 'undefined') return;
  observer = new MutationObserver(onMutations);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRS],
  });
}

function stopObserver(): void {
  observer?.disconnect();
  observer = null;
}

function restoreOriginals(): void {
  for (const node of translatedTextNodes) {
    const orig = ORIGINAL_TEXT.get(node);
    if (orig != null && node.nodeValue !== orig) {
      TRANSLATING_NODES.add(node);
      node.nodeValue = orig;
      TRANSLATING_NODES.delete(node);
    }
  }
  translatedTextNodes.clear();

  for (const el of translatedAttrElements) {
    const originals = ORIGINAL_ATTR.get(el);
    if (originals) {
      for (const [attr, orig] of Object.entries(originals)) {
        if (el.getAttribute(attr) !== orig) {
          markAttrWriting(el, attr, true);
          el.setAttribute(attr, orig);
          markAttrWriting(el, attr, false);
        }
      }
      ORIGINAL_ATTR.delete(el);
    }
  }
  translatedAttrElements.clear();
}

function applyLanguage(lang: string): void {
  const next = String(lang || 'en').split('-')[0].toLowerCase();
  const prev = currentLang;
  currentLang = next;

  cancelPendingScans();

  if (!isAutoTranslatableLanguage(next)) {
    stopObserver();
    if (prev !== 'en') restoreOriginals();
    for (const fn of langChangeListeners) fn(next);
    return;
  }

  if (prev !== 'en') {
    restoreOriginals();
  }

  startObserver();
  scheduleMultiPassScan(next);
  for (const fn of langChangeListeners) fn(next);
}

/** Get current translation language (for external consumers). */
export function getCurrentTranslationLang(): string {
  return currentLang;
}

/** Force a full DOM rescan (called after route changes, modal opens, etc.). */
export function forceRescan(): void {
  if (currentLang === 'en') return;
  scanQueued = false;
  doFullScan();
}

export function installDOMAutoTranslation(i18n: I18nInstance): void {
  if (installedI18n === i18n) return;
  installedI18n = i18n;

  const kick = () => {
    const lang = i18n.resolvedLanguage || i18n.language || 'en';
    applyLanguage(lang);
  };

  i18n.on('languageChanged', kick);

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kick, { once: true });
  } else {
    setTimeout(kick, 0);
  }
}
