import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../utils/zIndex';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Mobile Filter Sheet - Bottom Sheet Modal
 * Slides up from bottom for mobile-friendly filter UI.
 * Portaled to document.body so fixed positioning escapes `.native-app`
 * (transform: translateZ(0) creates a containing block that clips sheets).
 */
export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  isOpen,
  onClose,
  title = 'Filters',
  children,
  footer
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setPortalTarget(document.body);
  }, []);

  // Prevent body scroll when sheet is open (single lock — avoid position:fixed jump)
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    if (!body) return;
    const originalOverflow = body.style.overflow;

    body.style.overflow = 'hidden';

    return () => {
      if (!document.body) return;
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Escape key closes sheet
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen || !portalTarget) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 bg-black/50 animate-fade-in"
        style={{
          zIndex: Z_INDEX.modalBackdrop,
          animation: 'fade-in 0.2s ease-out',
        }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="mobile-sheet flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-filter-sheet-title"
        style={{
          zIndex: Z_INDEX.modal,
          maxHeight: 'min(85dvh, 85vh)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 shrink-0">
          <h2 id="mobile-filter-sheet-title" className="native-text-title">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mobile-tap-target p-2 -mr-2 active:opacity-50"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable (min-h-0 lets flex child shrink and scroll inside max-h sheet) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden native-scroll overscroll-contain px-4 py-4 pb-8">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-200 px-4 py-3 bg-white shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>,
    portalTarget,
  );
};

export default MobileFilterSheet;
