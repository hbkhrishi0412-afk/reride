import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import type { MobileFilterCategoryId } from './mobileFilterTypes.js';

const SIDEBAR_ITEMS: { id: MobileFilterCategoryId; labelKey: string }[] = [
  { id: 'price', labelKey: 'listings.mobileFilter.catPrice' },
  { id: 'brand', labelKey: 'listings.mobileFilter.catBrandModel' },
  { id: 'body', labelKey: 'listings.mobileFilter.catBody' },
  { id: 'year', labelKey: 'listings.mobileFilter.catYear' },
  { id: 'kms', labelKey: 'listings.mobileFilter.catKms' },
  { id: 'fuel', labelKey: 'listings.mobileFilter.catFuel' },
  { id: 'transmission', labelKey: 'listings.mobileFilter.catTransmission' },
  { id: 'ownership', labelKey: 'listings.mobileFilter.catOwnership' },
  { id: 'state', labelKey: 'listings.mobileFilter.catState' },
];

export interface MobileMarketplaceFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCategory: MobileFilterCategoryId;
  onActiveCategoryChange: (id: MobileFilterCategoryId) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  t: TFunction;
}

/**
 * Full-screen filter layout: left category rail, right options, sticky footer (CLEAR ALL + primary CTA).
 */
export const MobileMarketplaceFilterModal: React.FC<MobileMarketplaceFilterModalProps> = ({
  isOpen,
  onClose,
  activeCategory,
  onActiveCategoryChange,
  children,
  footer,
  t,
}) => {
  // Ensure the portal target exists (only on the client).
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    if (!body) return;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !portalTarget) return null;

  // Rendered through a portal to document.body so the modal escapes the
  // `.native-app` / `.native-scroll` transform trap (transform creates a new
  // containing block for fixed-position descendants AND a stacking context,
  // which was clipping the modal to the scrollable <main> region and letting
  // the bottom nav paint on top of it).
  const modal = (
    <div
      className="mobile-marketplace-filter-modal-root"
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
    >
      <div
        className="fixed inset-0 bg-black/45"
        style={{ zIndex: 9998 }}
        aria-hidden="true"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      />
      <div
        className="fixed inset-0 flex flex-col bg-white"
        style={{
          zIndex: 9999,
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          paddingTop: 'env(safe-area-inset-top, 0)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-filter-dialog-title"
      >
        <div className="flex flex-1 min-h-0">
          <nav
            className="w-[38%] max-w-[148px] shrink-0 bg-[#F5F5F5] border-r border-gray-200/80 overflow-y-auto native-scroll shadow-[4px_0_12px_-8px_rgba(0,0,0,0.15)]"
            aria-label={t('listings.mobileFilter.categoriesAria')}
          >
            {SIDEBAR_ITEMS.map((item) => {
              const active = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onActiveCategoryChange(item.id)}
                  className={`w-full text-left px-3 py-3.5 text-sm font-semibold leading-tight border-b border-gray-200/60 transition-colors ${
                    active
                      ? 'bg-[#222222] text-white'
                      : 'text-gray-800 active:bg-gray-200/80'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              );
            })}
          </nav>
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
            <div className="flex justify-end items-center px-3 py-2 border-b border-gray-100 shrink-0">
              <span id="mobile-filter-dialog-title" className="sr-only">
                {t('listings.filtersTitle')}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-lg text-gray-600 active:bg-gray-100"
                aria-label={t('listings.mobileFilter.closeAria')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto native-scroll px-4 py-3">{children}</div>
          </div>
        </div>
        <div className="shrink-0 bg-[#222222] border-t border-black/20 safe-bottom">{footer}</div>
      </div>
    </div>
  );

  return createPortal(modal, portalTarget);
};

export default MobileMarketplaceFilterModal;
