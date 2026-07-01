/**
 * Global translation provider that ensures ALL dynamic content in the app
 * is properly translated when the user switches languages.
 *
 * Strategy:
 *  1. On language change → bump a React context value so any component using
 *     useTranslationRefresh() re-renders to pick up new translations.
 *  2. On route change → trigger a DOM rescan to catch lazy-loaded content.
 *  3. Multi-pass DOM scanning catches async data that arrives after render.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { forceRescan } from '../lib/domAutoTranslate';

interface TranslationContextValue {
  /** Increments on every language change — subscribe to force re-render. */
  epoch: number;
  /** Current resolved language code (e.g. 'hi', 'te', 'ta', 'en'). */
  lang: string;
}

const TranslationContext = createContext<TranslationContextValue>({
  epoch: 0,
  lang: 'en',
});

/**
 * Use in any component that renders dynamic (non-i18n-key) content to
 * force re-render when the language changes. Just destructure `lang`
 * and the component will automatically re-render on language switch.
 */
export function useTranslationRefresh(): TranslationContextValue {
  return useContext(TranslationContext);
}

interface TranslationProviderProps {
  children: React.ReactNode;
}

const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [epoch, setEpoch] = useState(0);
  const [lang, setLang] = useState(
    () => (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase()
  );
  const prevPathRef = useRef(location.pathname);

  const onLanguageChanged = useCallback((lng: string) => {
    const newLang = String(lng || 'en').split('-')[0].toLowerCase();
    setLang(newLang);
    setEpoch((e) => e + 1);
  }, []);

  useEffect(() => {
    const handler = (lng: string) => {
      onLanguageChanged(lng);
      setTimeout(forceRescan, 80);
      setTimeout(forceRescan, 300);
      setTimeout(forceRescan, 900);
    };
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, [i18n, onLanguageChanged]);

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      const t1 = setTimeout(forceRescan, 150);
      const t2 = setTimeout(forceRescan, 600);
      const t3 = setTimeout(forceRescan, 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [location.pathname]);

  const contextValue = React.useMemo<TranslationContextValue>(
    () => ({ epoch, lang }),
    [epoch, lang]
  );

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

export default TranslationProvider;
