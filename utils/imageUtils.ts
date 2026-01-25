/**
 * Image utility functions for handling image sources and validation
 */

const DEFAULT_PLACEHOLDER = 'https://via.placeholder.com/800x600?text=Car+Image';

/**
 * Detects browser support for modern image formats
 * @returns Object with format support flags
 */
const detectFormatSupport = (): { webp: boolean; avif: boolean } => {
  if (typeof window === 'undefined') {
    return { webp: false, avif: false };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  
  return {
    webp: ctx ? canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 : false,
    avif: ctx ? canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0 : false
  };
};

// Cache format support detection
let formatSupport: { webp: boolean; avif: boolean } | null = null;

/**
 * Gets the best image format URL based on browser support
 * Enhanced with automatic WebP/AVIF conversion for all image sources
 * @param url - The original image URL
 * @param width - Desired width (optional)
 * @param quality - Image quality (1-100, optional)
 * @returns Optimized image URL with format conversion
 */
export const getOptimizedImageUrl = (url: string, width?: number, quality: number = 80): string => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // Detect format support once
  if (!formatSupport) {
    formatSupport = detectFormatSupport();
  }

  // Cloudinary optimization with format conversion
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      const transformations: string[] = [];
      
      // Add format conversion (AVIF > WebP > auto)
      if (formatSupport.avif) {
        transformations.push('f_avif');
      } else if (formatSupport.webp) {
        transformations.push('f_webp');
      } else {
        transformations.push('f_auto'); // Cloudinary auto-detects best format
      }
      
      if (width) transformations.push(`w_${width}`);
      if (quality) transformations.push(`q_${quality}`);
      transformations.push('c_limit'); // Limit dimensions
      transformations.push('dpr_auto'); // Auto device pixel ratio
      
      if (transformations.length > 0) {
        return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
      }
    }
    return url;
  }

  // ImageKit optimization with format conversion
  if (url.includes('ik.imagekit.io')) {
    const params: string[] = [];
    
    // Add format conversion
    if (formatSupport.avif) {
      params.push('f=avif');
    } else if (formatSupport.webp) {
      params.push('f=webp');
    }
    
    if (width) params.push(`tr=w-${width}`);
    if (quality) params.push(`q-${quality}`);
    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  }

  // Supabase Storage - use transformations API
  if (url.includes('supabase.co') && url.includes('/storage/')) {
    const params: string[] = [];
    
    // Supabase Storage supports format conversion via transformations
    const format = formatSupport.avif ? 'avif' : formatSupport.webp ? 'webp' : 'auto';
    if (format !== 'auto') {
      params.push(`format=${format}`);
    }
    if (width) params.push(`width=${width}`);
    if (quality) params.push(`quality=${quality}`);
    params.push('resize=cover'); // Optimize for thumbnails
    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  }

  // Firebase Storage / Google Cloud Storage
  if (url.includes('firebase') || url.includes('googleapis.com') || url.includes('googleusercontent.com')) {
    const params: string[] = [];
    
    // Firebase Storage doesn't support format conversion natively, but we can optimize size
    if (width) params.push(`w=${width}`);
    if (quality) params.push(`q=${quality}`);
    
    // For Google Cloud Storage, we can use transformations if available
    if (url.includes('googleapis.com') && params.length > 0) {
      return `${url}?${params.join('&')}`;
    }
    
    return url; // Return as-is if no transformations available
  }

  // Generic image optimization for any HTTP/HTTPS image URL
  // Use a CDN proxy service or add query parameters if the service supports it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // For unknown image services, we can use a CDN proxy like Cloudflare Images
    // or add format hints via Accept header (handled by browser)
    // For now, return the URL as-is but ensure proper sizing
    return url;
  }

  return url;
};

/**
 * Optimizes image URL for better performance (backward compatible)
 * Adds transformation parameters based on the storage provider
 * @param url - The original image URL
 * @param width - Desired width (optional)
 * @param quality - Image quality (1-100, optional)
 * @returns Optimized image URL
 */
export const optimizeImageUrl = (url: string, width?: number, quality: number = 80): string => {
  // Use the new format-aware optimization
  return getOptimizedImageUrl(url, width, quality);
};

/**
 * Validates and returns a safe image source
 * @param src - The image source to validate
 * @param fallback - Optional fallback image source
 * @returns A valid image source or fallback
 */
export const getSafeImageSrc = (src: string | undefined | null, fallback?: string): string => {
  // Check if src is empty, null, or undefined
  if (!src || src.trim() === '') {
    return fallback || DEFAULT_PLACEHOLDER;
  }
  
  // Check if src is a valid URL or data URI
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  
  // If it's a relative path, make it absolute
  if (src.startsWith('/')) {
    return src;
  }
  
  // Default fallback for invalid sources
  return fallback || DEFAULT_PLACEHOLDER;
};

/**
 * Validates an array of image sources and returns only valid ones
 * @param images - Array of image sources
 * @returns Array of valid image sources
 */
export const getValidImages = (images: string[]): string[] => {
  if (!Array.isArray(images)) {
    return [DEFAULT_PLACEHOLDER];
  }
  
  const validImages = images
    .filter(img => img && img.trim() !== '')
    .map(img => getSafeImageSrc(img));
  
  // Return at least one placeholder if no valid images
  return validImages.length > 0 ? validImages : [DEFAULT_PLACEHOLDER];
};

/**
 * Gets the first valid image from an array
 * @param images - Array of image sources
 * @returns First valid image source or placeholder
 */
export const getFirstValidImage = (images: string[]): string => {
  const validImages = getValidImages(images);
  return validImages[0];
};

