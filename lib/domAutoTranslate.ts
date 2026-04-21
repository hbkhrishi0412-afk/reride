/**
 * DOM auto-translator.
 *
 * Walks the rendered DOM and translates English text nodes + select
 * attributes (placeholder / title / alt / aria-label) into the active
 * i18next language whenever that language is not English.
 *
 * Uses the shared `translateText` engine (same cache + batching as the
 * i18next missing-key handler), so the first Hindi/Telugu/Tamil visit
 * populates the cache and every later visit is instant and offline-safe.
 *
 * Components that use `t()` already render in the target language, so
 * their text won't match "English text" heuristics and won't be touched.
 * Components that ship hardcoded English strings (dashboards, admin,
 * seller profiles, etc.) get translated live without any refactor.
 *
 * Opt out per-element by adding `data-no-translate` anywhere on a parent.
 */
import type { i18n as I18nInstance } from 'i18next';
import {
  translateText,
  getCachedTranslation,
  isAutoTranslatableLanguage,
} from './dynamicTranslate';

/**
 * Entire subtree rejected (scripts, SVG internals, embeds).
 * NOTE: INPUT / TEXTAREA / SELECT are NOT listed — placeholders and <option>
 * labels must be discoverable; text-node translation skips INPUT/TEXTAREA value
 * nodes separately so typed content is never overwritten.
 */
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
/** Prevents our own setAttribute from re-triggering translate in the same tick. */
const ATTR_WRITING = new WeakMap<Element, Set<string>>();

let currentLang = 'en';
let observer: MutationObserver | null = null;
let scanQueued = false;
let installedI18n: I18nInstance | null = null;

function shouldSkipElement(el: Element | null | undefined): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest?.('[data-no-translate]')) return true;
  return false;
}

/** Never rewrite typed value / editor content inside form controls. */
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

/**
 * Heuristic: is this string worth sending to the translator?
 * Accept: has at least 2 consecutive ASCII letters somewhere.
 * Reject: pure whitespace, numbers, currency, symbols, emoji, CJK, Devanagari, etc.
 * This makes the walker idempotent — once translated, text won't re-match.
 */
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

  // Preserve leading/trailing whitespace — only translate the trimmed core.
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
    return;
  }

  ORIGINAL_TEXT.set(node, original);
  void translateText(core, langSnapshot).then((translated) => {
    if (!translated || translated === core) return;
    // If React has since replaced this node's text, abort.
    if (node.nodeValue !== original) return;
    // Wrong language session — user switched away before this completed.
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

  // Already showing the machine translation for this baseline — do not loop.
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
    return;
  }

  originals[attr] = original;
  ORIGINAL_ATTR.set(el, originals);

  void translateText(original, langSnapshot).then((translated) => {
    if (!translated || translated === original) return;
    if (currentLang !== langSnapshot || currentLang === 'en') return;
    // If React has rewritten the attribute, skip.
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

function scheduleFullScan(): void {
  if (scanQueued) return;
  scanQueued = true;
  const run = () => {
    scanQueued = false;
    if (currentLang === 'en') return;
    walkSubtree(document.body);
  };
  if (typeof (window as unknown as { requestIdleCallback?: unknown })
    .requestIdleCallback === 'function') {
    (
      window as unknown as {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
      }
    ).requestIdleCallback(run, { timeout: 400 });
  } else {
    setTimeout(run, 50);
  }
}

function onMutations(mutations: MutationRecord[]): void {
  if (currentLang === 'en') return;
  for (const m of mutations) {
    if (m.type === 'characterData') {
      const t = m.target;
      if (t.nodeType === Node.TEXT_NODE && !TRANSLATING_NODES.has(t as Text)) {
        // React wrote new text — reset baseline and re-translate.
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
          walkSubtree(node);
        }
      }
    }
  }
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

/**
 * Restore all previously translated text/attrs back to their English originals.
 * Called when the user switches back to English.
 */
function restoreOriginals(): void {
  // WeakMaps can't be iterated, so we do a fresh DOM walk and reset anything
  // whose current value differs from what looks like English text. We rely on
  // React re-mounting to eventually converge; this is best-effort for nodes
  // still alive at switch-time.
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
  );
  let n: Node | null = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const orig = ORIGINAL_TEXT.get(n as Text);
      if (orig && (n as Text).nodeValue !== orig) {
        TRANSLATING_NODES.add(n as Text);
        (n as Text).nodeValue = orig;
        TRANSLATING_NODES.delete(n as Text);
      }
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const originals = ORIGINAL_ATTR.get(el);
      if (originals) {
        for (const [attr, orig] of Object.entries(originals)) {
          if (el.getAttribute(attr) !== orig) {
            el.setAttribute(attr, orig);
          }
        }
      }
    }
    n = walker.nextNode();
  }
}

function applyLanguage(lang: string): void {
  const next = String(lang || 'en').split('-')[0].toLowerCase();
  const prev = currentLang;
  currentLang = next;

  if (!isAutoTranslatableLanguage(next)) {
    stopObserver();
    if (prev !== 'en') restoreOriginals();
    return;
  }

  if (prev === 'en' && next !== 'en') {
    // No need to restore — we haven't touched anything yet this session.
  } else if (prev !== 'en' && prev !== next) {
    // Switching between two non-English langs — revert to English first so
    // the next pass translates fresh from the original.
    restoreOriginals();
  }

  startObserver();
  scheduleFullScan();
}

/**
 * Install runtime DOM auto-translation. Reacts to `languageChanged` events
 * from i18next so switching the language propagates everywhere — dashboards,
 * admin panels, seller profiles, notifications, modals — even when those
 * components never called `t()`.
 */
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
    // Run after the current tick so React's first render has committed.
    setTimeout(kick, 0);
  }
}
