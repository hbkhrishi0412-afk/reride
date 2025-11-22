import React, { useState, useRef, useEffect } from 'react';
import LazyImage from './LazyImage';

interface MobileImageGalleryProps {
  images: string[];
  alt?: string;
  onClose?: () => void;
}

/**
 * Mobile Image Gallery with Swipe Support
 * Full-screen swipeable image gallery optimized for mobile
 */
export const MobileImageGallery: React.FC<MobileImageGalleryProps> = ({
  images,
  alt = 'Vehicle image',
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  if (images.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-200 flex items-center justify-center rounded-lg">
        <span className="text-gray-500">No images available</span>
      </div>
    );
  }

  return (
    <div
      ref={galleryRef}
      className="relative w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Image Container */}
      <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
        <LazyImage
          src={images[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className="w-full h-full object-cover rounded-lg"
          width={1200}
          quality={90}
        />

        {/* Navigation Arrows - Only show if more than 1 image */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={`absolute left-2 top-1/2 transform -translate-y-1/2 mobile-tap-target bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg transition-opacity ${
                currentIndex === 0 ? 'opacity-50' : 'opacity-100 active:scale-90'
              }`}
              aria-label="Previous image"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={goToNext}
              disabled={currentIndex === images.length - 1}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 mobile-tap-target bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg transition-opacity ${
                currentIndex === images.length - 1 ? 'opacity-50' : 'opacity-100 active:scale-90'
              }`}
              aria-label="Next image"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-white text-sm font-semibold">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        )}

        {/* Close Button (if onClose provided) */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 mobile-tap-target bg-black/60 backdrop-blur-sm rounded-full p-2 active:scale-90"
            aria-label="Close gallery"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto native-scroll pb-2 scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                currentIndex === index
                  ? 'border-orange-500 scale-105'
                  : 'border-gray-200 opacity-60'
              }`}
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
      )}

      {/* Swipe Indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex gap-1">
          {images.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-all ${
                currentIndex === index
                  ? 'w-6 bg-orange-500'
                  : 'w-1 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileImageGallery;

