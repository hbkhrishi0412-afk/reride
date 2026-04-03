import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
] as const;

export type AppLanguageCode = (typeof LANGUAGE_OPTIONS)[number]['code'];

function resolveCode(lang: string | undefined): AppLanguageCode {
  const base = (lang || 'en').split('-')[0].toLowerCase();
  const found = LANGUAGE_OPTIONS.find((o) => o.code === base);
  return found?.code ?? 'en';
}

interface LanguageSwitcherProps {
  /** Compact dropdown with globe (header desktop) */
  variant?: 'dropdown' | 'inline';
  /** Globe-only control for narrow bars (e.g. mobile home) */
  compact?: boolean;
  className?: string;
  /** e.g. close mobile drawer after pick */
  onSelect?: () => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  compact = false,
  className = '',
  onSelect,
}) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const compactButtonRef = useRef<HTMLButtonElement>(null);
  const compactPanelRef = useRef<HTMLDivElement>(null);
  const [compactMenuRect, setCompactMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const currentCode = resolveCode(i18n.resolvedLanguage || i18n.language);
  const current = LANGUAGE_OPTIONS.find((o) => o.code === currentCode) || LANGUAGE_OPTIONS[0];

  const closeIfOutside = (target: Node | null) => {
    if (!target) return;
    if (rootRef.current?.contains(target)) return;
    if (compactPanelRef.current?.contains(target)) return;
    setOpen(false);
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => closeIfOutside(e.target as Node);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onDoc = (e: TouchEvent) => closeIfOutside(e.target as unknown as Node);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => document.removeEventListener('touchstart', onDoc);
  }, []);

  const select = (code: AppLanguageCode) => {
    void i18n.changeLanguage(code);
    setOpen(false);
    setCompactMenuRect(null);
    onSelect?.();
  };

  const updateCompactMenuPosition = () => {
    const el = compactButtonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelMin = 200;
    const panelWidth = Math.min(Math.max(rect.width, panelMin), window.innerWidth - 16);
    let left = rect.left;
    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8;
    }
    if (left < 8) left = 8;
    const gap = 8;
    const top = rect.bottom + gap;
    const bottomReserve = 24;
    const maxHeight = Math.max(160, window.innerHeight - top - bottomReserve);
    setCompactMenuRect({ top, left, width: panelWidth, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open || !compact || variant !== 'dropdown') {
      setCompactMenuRect(null);
      return;
    }
    updateCompactMenuPosition();
    const onResize = () => updateCompactMenuPosition();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
    };
  }, [open, compact, variant]);

  if (compact && variant === 'dropdown') {
    const portalTarget = typeof document !== 'undefined' ? document.body : null;

    return (
      <div className={`relative ${className}`} ref={rootRef}>
        <button
          ref={compactButtonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:scale-95"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t('lang.ariaChooseLanguage')}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
        {open &&
          portalTarget &&
          compactMenuRect &&
          createPortal(
            <div
              ref={compactPanelRef}
              role="listbox"
              className="fixed z-[220] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
              style={{
                top: compactMenuRect.top,
                left: compactMenuRect.left,
                width: compactMenuRect.width,
                maxHeight: compactMenuRect.maxHeight,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  role="option"
                  aria-selected={current.code === opt.code}
                  onClick={() => select(opt.code)}
                  className={`flex min-h-[48px] w-full items-center px-4 py-3 text-left text-base transition-colors hover:bg-gray-50 active:bg-gray-100 ${
                    current.code === opt.code ? 'font-semibold text-blue-600 bg-blue-50/70' : 'text-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            portalTarget
          )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`px-4 py-3 ${className}`}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('lang.label')}</p>
        <div className="flex flex-col gap-1">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => select(opt.code)}
              className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                current.code === opt.code
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white/90 px-2 py-1.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('lang.ariaChooseLanguage')}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-4 w-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
        <span>{current.label}</span>
        <svg
          className={`h-3 w-3 shrink-0 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-[60] mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              role="option"
              aria-selected={current.code === opt.code}
              onClick={() => select(opt.code)}
              className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                current.code === opt.code ? 'font-semibold text-blue-600 bg-blue-50/50' : 'text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
