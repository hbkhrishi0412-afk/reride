import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SUPPORTED = new Set(['en', 'hi', 'te', 'ta']);

/**
 * Keeps <html lang="..."> in sync with i18n for a11y, SEO, and font/shaping behavior.
 * Subscribes to language changes so updates are immediate when the user switches language.
 */
const I18nDocumentSync: React.FC = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    const raw = i18n.resolvedLanguage || i18n.language || 'en';
    const base = raw.split('-')[0].toLowerCase();
    document.documentElement.lang = SUPPORTED.has(base) ? base : 'en';
  }, [i18n, i18n.language, i18n.resolvedLanguage]);

  return null;
};

export default I18nDocumentSync;
