/**
 * Image utility functions for handling image sources and validation
 */

/** Inline SVG — no external fetch (avoids blocked networks / ERR_CONNECTION_CLOSED on via.placeholder.com). */
const vehiclePlaceholderSvg = (w: number, h: number, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect fill="#e5e7eb" width="100%" height="100%"/><g fill="#9ca3af" font-family="system-ui,sans-serif"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.max(14, Math.round(Math.min(w, h) * 0.06))}">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}</text></g></svg>`;

export const VEHICLE_IMAGE_PLACEHOLDER_DATA_URI = `data:image/svg+xml,${encodeURIComponent(vehiclePlaceholderSvg(800, 600, 'No image'))}`;

export const VEHICLE_THUMB_PLACEHOLDER_DATA_URI = `data:image/svg+xml,${encodeURIComponent(vehiclePlaceholderSvg(112, 80, 'No image'))}`;

export const VEHICLE_SMALL_CARD_PLACEHOLDER_DATA_URI = `data:image/svg+xml,${encodeURIComponent(vehiclePlaceholderSvg(200, 150, 'No image'))}`;

/** True for our inline placeholders (skip network recovery / infinite onError loops). */
export const isInlineImagePlaceholder = (url: string | undefined | null): boolean =>
  typeof url === 'string' && url.startsWith('data:image/svg+xml,');

const DEFAULT_PLACEHOLDER = VEHICLE_IMAGE_PLACEHOLDER_DATA_URI;

/**
 * Rewrites image URLs for known CDNs (Cloudinary, ImageKit) and returns safe URLs for storage hosts.
 * Avoids client-side AVIF/WebP forcing — Android WebViews often mis-report or fail to decode.
 * @param url - The original image URL
 * @param width - Desired width (optional)
 * @param quality - Image quality (1-100, optional)
 * @returns Optimized image URL where supported
 */
export const getOptimizedImageUrl = (url: string, width?: number, quality: number = 80): string => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // Cloudinary optimization — use f_auto only. Canvas-based AVIF/WebP detection often mismatches
  // Android WebView <img> decode support and breaks list images while detail (raw URL) still works.
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      const transformations: string[] = [];
      transformations.push('f_auto');
      
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

  // ImageKit — resize/quality only; do not force AVIF/WebP (WebView decode issues). Append with & if URL already has ?.
  if (url.includes('ik.imagekit.io')) {
    const params: string[] = [];
    if (width) params.push(`tr=w-${width}`);
    if (quality) params.push(`q-${quality}`);
    if (params.length === 0) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${params.join('&')}`;
  }

  // Supabase: on-the-fly transforms live at `/storage/v1/render/image/public/...`
  // (Pro+ or projects with image transformations enabled). Rewrite the raw
  // `/object/public/...` URL to the render endpoint only when a width was
  // requested — without this, cards would always download the full-size
  // original (e.g. a 425 KB PNG for the 2023 Toyota Innova hero), which can
  // stall/fail on slower connections and render as a blank gray tile while
  // lighter WebP siblings load fine. LazyImage falls back to the raw object
  // URL on error if transforms are not enabled for the project.
  if (url.includes('supabase.co') && url.includes('/storage/v1/object/public/')) {
    const raw = url.split('?')[0];
    if (!width) return raw;
    const rendered = raw.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const params: string[] = [`width=${width}`];
    if (quality) params.push(`quality=${quality}`);
    params.push('resize=contain');
    return `${rendered}?${params.join('&')}`;
  }
  // Already a render/transform URL — avoid double-appending params
  if (url.includes('supabase.co') && url.includes('/storage/v1/render/image/public/')) {
    return url;
  }

  // Firebase Storage / Google Cloud Storage — do not append w=/q=; those are not supported, and using
  // `?` breaks URLs that already have a query string (e.g. ?alt=media&token=...).
  if (url.includes('firebase') || url.includes('googleapis.com') || url.includes('googleusercontent.com')) {
    return url;
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
 * Packaged Android WebView (`appassets.androidplatform.net`) and Capacitor `https://localhost`
 * resolve root-relative URLs against the wrong origin. Rewrite `/api/...` (and similar) to the
 * production site so vehicle images load; keep `/assets/*` on the local bundle.
 */
export function rewriteRootRelativeMediaUrlForPackagedApp(url: string): string {
  if (!url || typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return url;
  }
  if (url.startsWith('/assets/')) {
    return url;
  }
  if (typeof window === 'undefined') {
    return url;
  }
  const h = window.location.hostname.toLowerCase();
  const port = window.location.port || '';
  const devPorts = ['5173', '4173', '3000', '8080'];
  const loopback = h === 'localhost' || h === '127.0.0.1';
  const packagedHttpsLoopback =
    loopback && window.location.protocol === 'https:' && !devPorts.includes(port);
  const androidAssetLoader =
    h === 'appassets.androidplatform.net' || h.includes('appassets.androidplatform.net');
  if (!androidAssetLoader && !packagedHttpsLoopback) {
    return url;
  }
  const origin = 'https://www.reride.co.in';
  return `${origin}${url}`;
}

/**
 * Checks if an image URL is from a known placeholder service that returns random/unusable images.
 *
 * Note: `picsum.photos` is intentionally NOT filtered here — the mock/seed data
 * (localStorage/reRideVehicles.json, FALLBACK_VEHICLES, dev-api-server, etc.) uses
 * deterministic `picsum.photos/seed/<slug>/800/600` URLs as legitimate demo images.
 * Treating them as placeholders caused demo listings (e.g. the 2023 Toyota Innova in
 * Ahmedabad, seed "ToyotaInnova27") to render as "No image" on the home carousel.
 *
 * Similarly `unsplash.com` proper (e.g. `images.unsplash.com/photo-<id>`) returns
 * specific deterministic images — only `source.unsplash.com/...` returns random
 * content, so we filter only that.
 * @param url - The image URL to check
 * @returns true if the URL is from a placeholder service
 */
const isPlaceholderService = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('via.placeholder.com') ||
         lowerUrl.includes('placeholder.com') ||
         lowerUrl.includes('loremflickr.com') ||
         lowerUrl.includes('source.unsplash.com');
};

/**
 * Validates an array of image sources and returns only valid ones.
 * Converts Supabase Storage paths to public URLs so images load correctly.
 * @param images - Array of image sources (URLs or storage paths)
 * @param vehicleId - Optional vehicle id to resolve relative paths like "image.jpg"
 * @returns Array of valid image URLs
 */
export const getValidImages = (images: string[], vehicleId?: number): string[] => {
  if (!Array.isArray(images)) {
    return [DEFAULT_PLACEHOLDER];
  }

  const toUrl = (img: string) =>
    isSupabaseStoragePath(img) ? convertStoragePathToUrl(img, vehicleId) : img;

  const validImages = images
    .filter(img => {
      if (!img || img.trim() === '') return false;
      if (isPlaceholderService(img)) return false;
      return true;
    })
    .map((img) => rewriteRootRelativeMediaUrlForPackagedApp(getSafeImageSrc(toUrl(img))));
  
  return validImages.length > 0 ? validImages : [DEFAULT_PLACEHOLDER];
};

/** Supabase Storage bucket used for vehicle images */
const SUPABASE_IMAGES_BUCKET = 'Images';

/**
 * Builds a Supabase Storage public URL from a path (no client required).
 * Works in both browser and SSR when VITE_SUPABASE_URL is set.
 */
const buildSupabasePublicUrl = (path: string): string | null => {
  if (!path || typeof path !== 'string' || path.trim() === '') return null;
  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env && typeof (import.meta.env as Record<string, string>).VITE_SUPABASE_URL === 'string'
      ? (import.meta.env as Record<string, string>).VITE_SUPABASE_URL.replace(/\/$/, '')
      : typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.replace?.(/\/$/, '');
  if (!baseUrl || !baseUrl.startsWith('https://') || !baseUrl.includes('.supabase.co')) return null;
  const normalizedPath = path.trim().replace(/^\//, '');
  return `${baseUrl}/storage/v1/object/public/${SUPABASE_IMAGES_BUCKET}/${normalizedPath}`;
};

/**
 * Checks if an image URL is a Supabase Storage path that needs conversion
 * @param url - The image URL/path to check
 * @returns true if it's a Supabase Storage path
 */
const isSupabaseStoragePath = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  // Check if it looks like a storage path (no http/https, contains path separators or is just a filename)
  return !url.startsWith('http://') &&
         !url.startsWith('https://') &&
         !url.startsWith('data:') &&
         !url.startsWith('blob:') &&
         url.trim() !== '';
};

/**
 * Converts a Supabase Storage path to a public URL (synchronous).
 * Uses VITE_SUPABASE_URL so it works without Supabase client (reliable in ESM/Vite).
 * @param path - The storage path (e.g., "vehicles/123/image.jpg")
 * @param vehicleId - Optional vehicle id to build path when path is just a filename
 * @returns Public URL or original path if conversion fails
 */
const convertStoragePathToUrl = (path: string, vehicleId?: number): string => {
  try {
    let filePath = path.trim();
    if (!filePath) return path;
    // Build path if we only have a filename
    if (!filePath.includes('/') && vehicleId != null) {
      filePath = `vehicles/${vehicleId}/${filePath}`;
    } else if (!filePath.includes('/')) {
      filePath = `vehicles/${filePath}`;
    }
    const url = buildSupabasePublicUrl(filePath);
    return url || path;
  } catch {
    return path;
  }
};

/**
 * Gets the first valid image from an array
 * @param images - Array of image sources (URLs or Supabase Storage paths)
 * @param vehicleId - Optional vehicle id to resolve relative paths like "image.jpg"
 * @returns First valid image URL or placeholder
 */
export const getFirstValidImage = (images: string[], vehicleId?: number): string => {
  if (!Array.isArray(images) || images.length === 0) {
    return DEFAULT_PLACEHOLDER;
  }

  for (const img of images) {
    if (!img || img.trim() === '') continue;
    if (isPlaceholderService(img)) continue;

    if (isSupabaseStoragePath(img)) {
      const converted = convertStoragePathToUrl(img, vehicleId);
      if (converted && converted !== img && !isPlaceholderService(converted)) {
        return rewriteRootRelativeMediaUrlForPackagedApp(converted);
      }
    } else {
      return rewriteRootRelativeMediaUrlForPackagedApp(getSafeImageSrc(img));
    }
  }

  return DEFAULT_PLACEHOLDER;
};

function escapeSvgText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/** SVG data-URI avatar (no external fetch) — reliable when third-party avatars are blocked or logos 404. */
export function sellerInitialsAvatarDataUri(seller: {
  dealershipName?: string;
  name?: string;
  email?: string;
}): string {
  const label = (seller.dealershipName || seller.name || seller.email || 'D').trim();
  const text = (label.slice(0, 2).toUpperCase() || '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect fill="#FF6B35" width="100%" height="100%"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="40" font-weight="600">${escapeSvgText(text)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Resolves seller logo for img elements: HTTPS URLs, same-origin paths, Supabase Storage paths under Images bucket.
 */
export function resolveSellerLogoUrl(seller: {
  logoUrl?: string | null;
  email?: string;
  dealershipName?: string;
  name?: string;
}): string {
  const fb = sellerInitialsAvatarDataUri(seller);
  const raw = seller.logoUrl?.trim();
  if (!raw) return fb;

  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  if (raw.startsWith('/')) {
    if (typeof window !== 'undefined') return `${window.location.origin}${raw}`;
    return raw;
  }

  const clean = raw.replace(/^\//, '');
  const attempts = [clean, ...(clean.includes('/') ? [] : [`logos/${clean}`])];
  for (const p of attempts) {
    const url = buildSupabasePublicUrl(p);
    if (url) return url;
  }
  return fb;
}

