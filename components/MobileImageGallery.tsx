import React, { useState, useRef, useEffect } from 'react';

interface MobileImageGalleryProps {
  images: string[];
  alt?: string;
  onClose?: () => void;
}

/**
 * Mobile Image Gallery with Swipe Support
 * Full-screen swipeable image gallery optimized for mobile
 * Supports pinch-to-zoom and scrollable images
 */
export const MobileImageGallery: React.FC<MobileImageGalleryProps> = ({
  images,
  alt = 'Vehicle image',
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const imageRef = useRef<HTMLImageElement>(null);

  const minSwipeDistance = 50;

  // Prevent body scroll when gallery is open
  useEffect(() => {
    if (onClose) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only handle horizontal swipes if not zoomed
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Only track horizontal movement for single touch
    if (e.touches.length === 1) {
      touchEndX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Only process swipe if single touch (not pinch zoom)
    if (e.changedTouches.length === 1 && touchStartX.current && touchEndX.current) {
      const distance = touchStartX.current - touchEndX.current;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe && currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
      if (isRightSwipe && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }

      touchStartX.current = 0;
      touchEndX.current = 0;
    }
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!onClose) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, onClose]);

  if (images.length === 0) {
    return null;
  }

  // If onClose is provided, render as full-screen modal
  if (onClose) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black"
        style={{ 
          touchAction: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Close Button - Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 mobile-tap-target bg-black/60 backdrop-blur-sm rounded-full p-3 active:scale-90 transition-transform"
          style={{ minWidth: '44px', minHeight: '44px' }}
          aria-label="Close gallery"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Main Image Container - Scrollable and Zoomable */}
        <div 
          className="w-full h-full flex items-center justify-center overflow-auto"
          style={{ 
            touchAction: 'pan-x pan-y pinch-zoom',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="min-w-full min-h-full flex items-center justify-center p-4">
            <img
              ref={imageRef}
              src={images[currentIndex]}
              alt={`${alt} ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain select-none"
              style={{ 
                touchAction: 'pan-x pan-y pinch-zoom',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                ...({ WebkitUserDrag: 'none' } as React.CSSProperties)
              }}
              draggable={false}
            />
          </div>
        </div>

        {/* Navigation Arrows - Only show if more than 1 image */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-50 mobile-tap-target bg-black/60 backdrop-blur-sm rounded-full p-3 shadow-lg transition-opacity ${
                currentIndex === 0 ? 'opacity-30' : 'opacity-100 active:scale-90'
              }`}
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label="Previous image"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={goToNext}
              disabled={currentIndex === images.length - 1}
              className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-50 mobile-tap-target bg-black/60 backdrop-blur-sm rounded-full p-3 shadow-lg transition-opacity ${
                currentIndex === images.length - 1 ? 'opacity-30' : 'opacity-100 active:scale-90'
              }`}
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label="Next image"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image Counter - Top Center */}
        {images.length > 1 && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-white text-sm font-semibold">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        )}

        {/* Thumbnail Strip - Bottom */}
        {images.length > 1 && (
          <div 
            className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 overflow-x-auto"
            style={{ 
              touchAction: 'pan-x',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            <div className="flex gap-3 justify-center">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => goToIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    currentIndex === index
                      ? 'border-orange-500 scale-110'
                      : 'border-white/30 opacity-60'
                  }`}
                  style={{ minWidth: '64px', minHeight: '64px' }}
                >
                  <img
                    src={image}
                    alt={`${alt} thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Swipe Indicator Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
            {images.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === index
                    ? 'w-6 bg-orange-500'
                    : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Inline gallery (when no onClose provided - for embedded use)
  return (
    <div className="relative w-full">
      <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
        <img
          src={images[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className="w-full h-full object-cover rounded-lg"
        />
      </div>
    </div>
  );
};

export default MobileImageGallery;
