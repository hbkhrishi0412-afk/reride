import React from 'react';
import { useTranslation } from 'react-i18next';

type AccessDeniedProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function AccessDenied({
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: AccessDeniedProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-h-[min(60vh,480px)] flex-col items-center justify-center px-6 py-16 text-center"
      role="alert"
      data-testid="access-denied"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-reride-orange">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
        {title ?? t('access.deniedTitle', { defaultValue: 'Access restricted' })}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
        {message ?? t('access.deniedMessage', { defaultValue: 'You do not have permission to view this page.' })}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="min-h-[44px] rounded-xl bg-reride-orange px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-reride-orange-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-reride-orange"
          >
            {actionLabel ?? t('access.signIn', { defaultValue: 'Sign in' })}
          </button>
        )}
        {onSecondary && secondaryLabel && (
          <button
            type="button"
            onClick={onSecondary}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-reride-orange"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
