import React, { useState, useRef, useEffect } from 'react';
import { getOptimizedImageUrl } from '../utils/imageUtils';

// Detect format support once
let formatSupport: { webp: boolean; avif: boolean } | null = null;
const detectFormatSupport = (): { webp: boolean; avif: boolean } => {
  if (typeof window === 'undefined') {
    return { webp: false, avif: false };
  }
  if (formatSupport) return formatSupport;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  
  formatSupport = {
    webp: ctx ? canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 : false,
    avif: ctx ? canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0 : false
  };
  return formatSupport;
};

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
  const [formatSupportState, setFormatSupportState] = useState<{ webp: boolean; avif: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Detect format support on mount
    const support = detectFormatSupport();
    setFormatSupportState(support);
    
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
  const optimizedSrc = isInView ? getOptimizedImageUrl(validSrc, width, quality) : '';
  const displaySrc = hasError ? (placeholder || 'https://via.placeholder.com/800x600?text=Car+Image') : optimizedSrc;

  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  const handleError = (e?: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Prevent infinite error loops
    const target = e?.target as HTMLImageElement;
    if (target && !target.src.includes('placeholder.com') && !target.src.includes('text=Car')) {
      // Try to convert Supabase storage path if it looks like one
      if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:')) {
        // This might be a Supabase storage path that wasn't converted
        try {
          if (typeof window !== 'undefined') {
            import('../lib/supabase.js').then(({ getSupabaseClient }) => {
              const supabase = getSupabaseClient();
              
              // Try different path formats
              const pathAttempts = [
                src, // Original path
                src.includes('/') ? src : `vehicles/${src}`, // Add vehicles prefix if missing
              ];
              
              for (const path of pathAttempts) {
                const { data } = supabase.storage
                  .from('Images')
                  .getPublicUrl(path);
                
                if (data?.publicUrl && data.publicUrl !== src) {
                  console.log('✅ LazyImage: Converted storage path to URL:', { original: src, path, url: data.publicUrl });
                  target.src = data.publicUrl;
                  return; // Don't set error if we can convert it
                }
              }
              
              // If all attempts failed, log for debugging
              console.warn('⚠️ LazyImage: Could not convert storage path:', {
                original: src,
                attemptedPaths: pathAttempts,
                error: 'No valid public URL generated'
              });
              setHasError(true);
            }).catch((err) => {
              console.error('❌ LazyImage: Error importing Supabase client:', err);
              setHasError(true);
            });
            return; // Don't set error immediately, wait for async conversion
          }
        } catch (err) {
          console.error('❌ LazyImage: Error in handleError:', err);
          // Fall through to set error
        }
      } else {
        // Log failed image load for debugging
        console.warn('⚠️ LazyImage: Image failed to load:', {
          src: target.src,
          originalSrc: src,
          isPlaceholder: target.src.includes('placeholder.com') || target.src.includes('text=Car')
        });
      }
    }
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

      {/* Actual Image - optimized with WebP/AVIF support */}
      {isInView && !hasError && finalSrc && (() => {
        const optimizedUrl = getOptimizedImageUrl(finalSrc, width, quality);
        const supports = formatSupportState || detectFormatSupport();
        
        // Use <picture> element for format selection if browser supports it
        // Otherwise fall back to single img with optimized URL
        if (supports.avif || supports.webp) {
          return (
            <picture>
              {/* AVIF source for modern browsers */}
              {supports.avif && (
                <source
                  srcSet={optimizedUrl}
                  type="image/avif"
                />
              )}
              {/* WebP source as fallback */}
              {supports.webp && !supports.avif && (
                <source
                  srcSet={optimizedUrl}
                  type="image/webp"
                />
              )}
              {/* Fallback img element */}
              <img
                ref={imgRef}
                src={optimizedUrl}
                alt={alt}
                className={`w-full h-full transition-opacity duration-300 ${
                  isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ objectFit: 'cover' }}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={fetchPriority}
                onLoad={handleLoad}
                onError={handleError}
                decoding="async"
                crossOrigin="anonymous"
              />
            </picture>
          );
        }
        
        // Fallback for browsers without format support
        return (
          <img
            ref={imgRef}
            src={optimizedUrl}
            alt={alt}
            className={`w-full h-full transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ objectFit: 'cover' }}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={fetchPriority}
            onLoad={handleLoad}
            onError={handleError}
            decoding="async"
            crossOrigin="anonymous"
          />
        );
      })()}

      {/* Fallback for browsers without Intersection Observer or immediate load */}
      {(typeof window === 'undefined' || !window.IntersectionObserver) && !hasError && finalSrc && (
        <img
          src={getOptimizedImageUrl(finalSrc, width, quality)}
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
