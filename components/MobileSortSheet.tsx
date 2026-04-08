import React, { useEffect } from 'react';
import type { TFunction } from 'i18next';

export interface MobileSortSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sortOrder: string;
  onSortChange: (value: string) => void;
  options: Record<string, string>;
  t: TFunction;
}

export const MobileSortSheet: React.FC<MobileSortSheetProps> = ({
  isOpen,
  onClose,
  sortOrder,
  onSortChange,
  options,
  t,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    if (!body) return;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9996] bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
        aria-hidden="true"
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-[9997] bg-white rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col safe-bottom"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-sort-title"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="px-4 pb-2 flex items-center justify-between border-b border-gray-100">
          <h2 id="mobile-sort-title" className="text-lg font-bold text-gray-900">
            {t('listings.mobileFilter.sortTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 text-gray-500"
            aria-label={t('listings.mobileFilter.closeAria')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ul className="overflow-y-auto native-scroll py-2 px-2">
          {Object.entries(options).map(([key, label]) => {
            const selected = sortOrder === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    onSortChange(key);
                    onClose();
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
                    selected ? 'bg-orange-50 text-orange-600' : 'text-gray-900 active:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default MobileSortSheet;
