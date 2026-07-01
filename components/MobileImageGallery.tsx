import React, { useState, useRef, useEffect, useCallback } from 'react';
import { swapToPlaceholderOnError } from '../utils/imageUtils';

interface MobileImageGalleryProps {
  images: string[];
  alt?: string;
  onClose?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const MIN_SWIPE_DISTANCE = 50;

type Point = { x: number; y: number };

type GestureMode = 'none' | 'pan' | 'pinch' | 'swipe';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(touches: TouchList) {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function clampTranslate(x: number, y: number, scale: number, width: number, height: number): Point {
  if (scale <= 1 || width <= 0 || height <= 0) {
    return { x: 0, y: 0 };
  }
  const maxX = (width * (scale - 1)) / 2;
  const maxY = (height * (scale - 1)) / 2;
  return {
    x: clamp(x, -maxX, maxX),
    y: clamp(y, -maxY, maxY),
  };
}

/**
 * Mobile Image Gallery with Swipe Support
 * Full-screen swipeable image gallery optimized for mobile
 * Supports pinch-to-zoom, pan when zoomed, and double-tap zoom
 */
export const MobileImageGallery: React.FC<MobileImageGalleryProps> = ({
  images,
  alt = 'Vehicle image',
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [animateTransform, setAnimateTransform] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const translateRef = useRef<Point>({ x: 0, y: 0 });
  const gestureRef = useRef<{
    mode: GestureMode;
    startScale: number;
    startTranslate: Point;
    startTouch: Point;
    startPinchDistance: number;
    swipeStartX: number;
  }>({
    mode: 'none',
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
    startTouch: { x: 0, y: 0 },
    startPinchDistance: 0,
    swipeStartX: 0,
  });
  const lastTapRef = useRef(0);

  const applyTransform = useCallback((scale: number, x: number, y: number, animate = false) => {
    const viewport = viewportRef.current;
    const clampedScale = clamp(scale, MIN_SCALE, MAX_SCALE);
    const nextTranslate =
      clampedScale <= 1
        ? { x: 0, y: 0 }
        : clampTranslate(
            x,
            y,
            clampedScale,
            viewport?.clientWidth ?? 0,
            viewport?.clientHeight ?? 0,
          );

    scaleRef.current = clampedScale;
    translateRef.current = nextTranslate;
    setAnimateTransform(animate);
    setTransform({ scale: clampedScale, ...nextTranslate });
  }, []);

  const resetZoom = useCallback(() => {
    applyTransform(1, 0, 0, true);
  }, [applyTransform]);

  const isZoomed = () => scaleRef.current > 1.01;

  // Prevent body scroll when gallery is open
  useEffect(() => {
    if (!onClose) return;
    const body = document.body;
    if (!body) return;
    const originalOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      if (document.body) document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    resetZoom();
    gestureRef.current.mode = 'none';
  }, [currentIndex, resetZoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !onClose) return;

    const onTouchMove = (e: TouchEvent) => {
      if (gestureRef.current.mode === 'pinch' || gestureRef.current.mode === 'pan') {
        e.preventDefault();
      }
    };

    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => viewport.removeEventListener('touchmove', onTouchMove);
  }, [onClose]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((index) => index + 1);
    }
  }, [currentIndex, images.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
    }
  }, [currentIndex]);

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setAnimateTransform(false);

    if (e.touches.length === 2) {
      gestureRef.current = {
        mode: 'pinch',
        startScale: scaleRef.current,
        startTranslate: { ...translateRef.current },
        startTouch: { x: 0, y: 0 },
        startPinchDistance: getTouchDistance(e.touches),
        swipeStartX: 0,
      };
      return;
    }

    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (isZoomed()) {
      gestureRef.current = {
        mode: 'pan',
        startScale: scaleRef.current,
        startTranslate: { ...translateRef.current },
        startTouch: { x: touch.clientX, y: touch.clientY },
        startPinchDistance: 0,
        swipeStartX: 0,
      };
      return;
    }

    gestureRef.current = {
      mode: 'swipe',
      startScale: 1,
      startTranslate: { x: 0, y: 0 },
      startTouch: { x: touch.clientX, y: touch.clientY },
      startPinchDistance: 0,
      swipeStartX: touch.clientX,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const gesture = gestureRef.current;

    if (gesture.mode === 'pinch' && e.touches.length === 2 && gesture.startPinchDistance > 0) {
      const distance = getTouchDistance(e.touches);
      const ratio = distance / gesture.startPinchDistance;
      applyTransform(gesture.startScale * ratio, gesture.startTranslate.x, gesture.startTranslate.y);
      return;
    }

    if (gesture.mode === 'pan' && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - gesture.startTouch.x;
      const dy = touch.clientY - gesture.startTouch.y;
      applyTransform(
        scaleRef.current,
        gesture.startTranslate.x + dx,
        gesture.startTranslate.y + dy,
      );
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const gesture = gestureRef.current;

    if (gesture.mode === 'swipe' && !isZoomed() && e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const distance = gesture.swipeStartX - endX;

      if (distance > MIN_SWIPE_DISTANCE) {
        goToNext();
      } else if (distance < -MIN_SWIPE_DISTANCE) {
        goToPrevious();
      } else {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
          applyTransform(DOUBLE_TAP_SCALE, 0, 0, true);
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      }
    }

    if (gesture.mode === 'pan') {
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - gesture.startTouch.x);
        const dy = Math.abs(touch.clientY - gesture.startTouch.y);
        if (dx < 12 && dy < 12) {
          const now = Date.now();
          if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            resetZoom();
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
          }
        }
      }
      applyTransform(scaleRef.current, translateRef.current.x, translateRef.current.y, true);
    } else if (gesture.mode === 'pinch') {
      applyTransform(scaleRef.current, translateRef.current.x, translateRef.current.y, true);
    }

    gestureRef.current.mode = 'none';
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    applyTransform(
      scaleRef.current * delta,
      translateRef.current.x,
      translateRef.current.y,
    );
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
  }, [currentIndex, onClose, goToNext, goToPrevious]);

  if (images.length === 0) {
    return null;
  }

  // If onClose is provided, render as full-screen modal
  if (onClose) {
    return (
      <div className="fixed inset-0 z-[100] bg-black">
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

        {/* Main Image Container - pinch / pan / double-tap zoom */}
        <div
          ref={viewportRef}
          className="w-full h-full overflow-hidden touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <div className="flex h-full w-full items-center justify-center p-4">
            <img
              src={images[currentIndex]}
              alt={`${alt} ${currentIndex + 1}`}
              className="max-h-full max-w-full select-none object-contain"
              style={{
                transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
                transition: animateTransform ? 'transform 0.2s ease-out' : 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                ...({ WebkitUserDrag: 'none' } as React.CSSProperties),
              }}
              draggable={false}
              onError={(e) => swapToPlaceholderOnError(e.currentTarget)}
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
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full pointer-events-none">
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
              msOverflowStyle: 'none',
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
                    decoding="async"
                    onError={(e) => swapToPlaceholderOnError(e.currentTarget)}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Swipe Indicator Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex gap-2 pointer-events-none">
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
    <div className="relative w-full max-w-full overflow-hidden">
      <div className="relative flex w-full items-center justify-center overflow-hidden bg-gray-100 aspect-[16/10] max-h-[min(42vh,300px)]">
        <img
          src={images[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className="max-h-full max-w-full h-full w-full object-contain object-center rounded-lg"
          onError={(e) => swapToPlaceholderOnError(e.currentTarget)}
        />
      </div>
    </div>
  );
};

export default MobileImageGallery;
