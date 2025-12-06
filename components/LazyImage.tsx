import React, { useState, useRef, useEffect } from 'react';
import { optimizeImageUrl } from '../utils/imageUtils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  quality?: number;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  eager?: boolean; // For critical above-the-fold images (LCP)
  fetchPriority?: 'high' | 'low' | 'auto'; // For LCP optimization
}

/**
 * Lazy-loaded Image Component with Intersection Observer
 * Optimized for mobile app performance
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width,
  quality = 80,
  placeholder,
  onLoad,
  onError,
  eager = false,
  fetchPriority = 'auto'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(eager); // Load immediately if eager
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Skip lazy loading for eager images (critical LCP images)
    if (eager) {
      setIsInView(true);
      return;
    }

    // Use Intersection Observer for lazy loading
    if (!containerRef.current || typeof window === 'undefined') {
      // Fallback: load immediately if IntersectionObserver is not available
      if (typeof window === 'undefined' || !window.IntersectionObserver) {
        setIsInView(true);
      }
      return;
    }

    // For mobile app, load images more aggressively (smaller threshold)
    const options = {
      root: null,
      rootMargin: '50px', // Start loading 50px before image enters viewport
      threshold: 0.01
    };

    try {
      observerRef.current = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      }, options);

      if (containerRef.current) {
        observerRef.current.observe(containerRef.current);
      }
    } catch (error) {
      // Fallback if IntersectionObserver fails
      if (process.env.NODE_ENV === 'development') {
        console.warn('IntersectionObserver not supported, loading image immediately');
      }
      setIsInView(true);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Ensure src is valid before optimizing
  const validSrc = src && src.trim() !== '' ? src : (placeholder || 'https://via.placeholder.com/800x600?text=Car+Image');
  const optimizedSrc = isInView ? optimizeImageUrl(validSrc, width, quality) : '';
  const displaySrc = hasError ? (placeholder || 'https://via.placeholder.com/800x600?text=Car+Image') : optimizedSrc;

  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setHasError(true);
    if (onError) onError();
  };

  // Use a default placeholder if src is empty or invalid
  const defaultPlaceholder = 'https://via.placeholder.com/800x600?text=Car+Image';
  const finalSrc = displaySrc || (src && src.trim() !== '' ? src : defaultPlaceholder);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {/* Placeholder/Skeleton */}
      {!isLoaded && !hasError && isInView && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse z-0" />
      )}

      {/* Error placeholder */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-300 flex items-center justify-center z-10">
          <div className="text-center text-gray-500 text-sm">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Image not available</p>
          </div>
        </div>
      )}

      {/* Actual Image */}
      {isInView && !hasError && finalSrc && (
        <img
          ref={imgRef}
          src={finalSrc}
          alt={alt}
          className={`w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectFit: 'cover' }}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={fetchPriority}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Fallback for browsers without Intersection Observer or immediate load */}
      {(typeof window === 'undefined' || !window.IntersectionObserver) && !hasError && finalSrc && (
        <img
          src={optimizeImageUrl(finalSrc, width, quality)}
          alt={alt}
          className={`w-full h-full`}
          style={{ objectFit: 'cover' }}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={fetchPriority}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
};

export default LazyImage;
