import React, { useEffect, useRef } from 'react';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Mobile Filter Sheet - Bottom Sheet Modal
 * Slides up from bottom for mobile-friendly filter UI
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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        style={{ animation: 'fade-in 0.2s ease-out' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="mobile-sheet z-50 flex flex-col"
        style={{
          maxHeight: '85vh',
          paddingBottom: 'env(safe-area-inset-bottom, 0)'
        }}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
          <h2 className="native-text-title">{title}</h2>
          <button
            onClick={onClose}
            className="mobile-tap-target p-2 -mr-2 active:opacity-50"
            aria-label="Close filters"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto native-scroll px-4 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-200 px-4 py-3 bg-white">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};

export default MobileFilterSheet;



