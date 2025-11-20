/**
 * Image utility functions for handling image sources and validation
 */

const DEFAULT_PLACEHOLDER = 'https://picsum.photos/800/600?random=1';

/**
 * Optimizes image URL for better performance
 * Adds transformation parameters based on the storage provider
 * @param url - The original image URL
 * @param width - Desired width (optional)
 * @param quality - Image quality (1-100, optional)
 * @returns Optimized image URL
 */
export const optimizeImageUrl = (url: string, width?: number, quality: number = 80): string => {
  if (!url || url.startsWith('data:')) {
    // Base64 or invalid URL, return as-is
    return url;
  }

  // Cloudinary optimization
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      const transformations: string[] = [];
      if (width) transformations.push(`w_${width}`);
      if (quality) transformations.push(`q_${quality}`);
      if (transformations.length > 0) {
        return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
      }
    }
    return url;
  }

  // ImageKit optimization
  if (url.includes('ik.imagekit.io')) {
    const params: string[] = [];
    if (width) params.push(`tr=w-${width}`);
    if (quality) params.push(`q-${quality}`);
    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  }

  // Firebase Storage - add query params for optimization
  if (url.includes('firebase') || url.includes('googleapis.com')) {
    const params: string[] = [];
    if (width) params.push(`width=${width}`);
    if (quality) params.push(`quality=${quality}`);
    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  }

  // For other URLs, return as-is (can be extended for other providers)
  return url;
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

