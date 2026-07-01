/**
 * React hooks for translating dynamic user-generated content (vehicle
 * descriptions, seller bios, feature names, city names, service titles,
 * notification text, review content, etc.) that isn't covered by static
 * i18n keys.
 *
 * Returns the translated string synchronously when the cache is warm,
 * otherwise returns the original and swaps in the translation once the
 * async fetch resolves.  Automatically re-translates when the active
 * language changes.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  translateText,
  getCachedTranslation,
  isAutoTranslatableLanguage,
} from '../lib/dynamicTranslate';

function normalizeLang(raw: string | undefined | null): string {
  return String(raw || 'en').split('-')[0].toLowerCase();
}

/**
 * Translate a single piece of dynamic text.
 * Returns the original when the language is English or unsupported.
 */
export function useTranslatedText(text: string | undefined | null): string {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage || i18n.language);
  const original = text ?? '';

  const [translated, setTranslated] = useState<string>(() => {
    if (!original || !isAutoTranslatableLanguage(lang)) return original;
    return getCachedTranslation(original, lang) ?? original;
  });

  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    if (!original) {
      setTranslated('');
      return;
    }

    if (!isAutoTranslatableLanguage(lang)) {
      setTranslated(original);
      return;
    }

    const cached = getCachedTranslation(original, lang);
    if (cached) {
      setTranslated(cached);
      return;
    }

    setTranslated(original);

    let cancelled = false;
    translateText(original, lang).then((result) => {
      if (cancelled) return;
      if (langRef.current !== lang) return;
      if (result && result !== original) {
        setTranslated(result);
      }
    });

    return () => { cancelled = true; };
  }, [original, lang]);

  return translated;
}

/**
 * Translate an array of strings (e.g. vehicle features, service bullets).
 * Returns the originals while translations are loading.
 */
export function useTranslatedArray(items: string[] | undefined | null): string[] {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage || i18n.language);
  const originals = items ?? [];

  const [translated, setTranslated] = useState<string[]>(() => {
    if (!isAutoTranslatableLanguage(lang)) return originals;
    return originals.map((s) => getCachedTranslation(s, lang) ?? s);
  });

  const langRef = useRef(lang);
  langRef.current = lang;

  // Stable serialization key — join with a separator that won't appear in content.
  const serialized = originals.join('\x00');

  useEffect(() => {
    if (originals.length === 0) {
      setTranslated([]);
      return;
    }

    if (!isAutoTranslatableLanguage(lang)) {
      setTranslated(originals);
      return;
    }

    const results = originals.map((s) => getCachedTranslation(s, lang) ?? s);
    setTranslated(results);

    const needsTranslation = originals
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !getCachedTranslation(s, lang));

    if (needsTranslation.length === 0) return;

    let cancelled = false;
    Promise.all(
      needsTranslation.map(({ s }) => translateText(s, lang))
    ).then((translated) => {
      if (cancelled) return;
      if (langRef.current !== lang) return;
      setTranslated((prev) => {
        const next = [...prev];
        translated.forEach((val, j) => {
          const idx = needsTranslation[j]?.i;
          if (idx != null && val) next[idx] = val;
        });
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [serialized, lang]);

  return translated;
}

/**
 * Translate a record of key→string values (e.g. { fuelType, color, city }).
 * Keys are preserved, values are translated.
 */
export function useTranslatedFields<K extends string>(
  fields: Record<K, string | undefined | null>
): Record<K, string> {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage || i18n.language);

  const keys = Object.keys(fields) as K[];
  const serialized = keys.map((k) => `${k}=${fields[k] ?? ''}`).join('|');

  const [translated, setTranslated] = useState<Record<K, string>>(() => {
    const result = {} as Record<K, string>;
    for (const k of keys) {
      const v = fields[k] ?? '';
      if (!v || !isAutoTranslatableLanguage(lang)) {
        result[k] = v;
      } else {
        result[k] = getCachedTranslation(v, lang) ?? v;
      }
    }
    return result;
  });

  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const result = {} as Record<K, string>;
    const pending: { key: K; value: string }[] = [];

    for (const k of keys) {
      const v = fields[k] ?? '';
      if (!v || !isAutoTranslatableLanguage(lang)) {
        result[k] = v;
      } else {
        const cached = getCachedTranslation(v, lang);
        result[k] = cached ?? v;
        if (!cached) pending.push({ key: k, value: v });
      }
    }

    setTranslated(result);

    if (pending.length === 0) return;

    let cancelled = false;
    Promise.all(pending.map(({ value }) => translateText(value, lang))).then(
      (results) => {
        if (cancelled) return;
        if (langRef.current !== lang) return;
        setTranslated((prev) => {
          const next = { ...prev };
          results.forEach((val, i) => {
            const p = pending[i];
            if (p && val) next[p.key] = val;
          });
          return next;
        });
      }
    );

    return () => { cancelled = true; };
  }, [serialized, lang]);

  return translated;
}
