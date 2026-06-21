import React from 'react';
import { useTranslation } from 'react-i18next';
import { getCategoryDisplayName } from '../utils/compareList.js';

interface CompareListBannerProps {
  count: number;
  comparisonCategory?: string | null;
  onOpenCompare: () => void;
  /** When true, sit above the mobile bottom tab bar. */
  aboveBottomNav?: boolean;
}

/**
 * Prompt shown on Browse Cars when the user has vehicles queued for compare.
 */
const CompareListBanner: React.FC<CompareListBannerProps> = ({
  count,
  comparisonCategory = null,
  onOpenCompare,
  aboveBottomNav = false,
}) => {
  const { t } = useTranslation();

  if (count <= 0) return null;

  const categoryLabel = comparisonCategory
    ? getCategoryDisplayName(comparisonCategory)
    : null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[45] px-3"
      style={{
        bottom: aboveBottomNav
          ? 'calc(56px + env(safe-area-inset-bottom, 0px) + 8px)'
          : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
      data-testid="compare-list-banner"
    >
      <button
        type="button"
        onClick={onOpenCompare}
        className="pointer-events-auto mx-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border border-blue-200/80 bg-white/95 px-4 py-3 text-left shadow-lg backdrop-blur-md active:scale-[0.99] transition-transform"
        aria-label={t('compare.viewBanner', { count })}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white shadow-sm">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-900">
            {t('compare.viewBanner', { count })}
          </span>
          {categoryLabel && (
            <span className="block truncate text-xs text-gray-500">
              {t('compare.viewBannerHint', { category: categoryLabel })}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-600">
          {t('compare.viewBannerAction')}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>
    </div>
  );
};

export default CompareListBanner;
