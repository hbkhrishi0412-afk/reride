/**
 * Auto-translating i18n: resolves t(key) then translates the English string
 * into hi/te/ta via the shared dynamicTranslate cache (same as vehicle descriptions).
 */
import { useTranslation, type TOptions } from 'react-i18next';
import { useTranslatedText } from './useTranslatedText';

/** Hook: return translated string for an i18n key. */
export function useAutoT(key: string, options?: TOptions): string {
  const { t } = useTranslation();
  const raw = t(key, options);
  return useTranslatedText(raw);
}
