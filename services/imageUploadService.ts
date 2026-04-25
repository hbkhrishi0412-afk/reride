/**
 * Image Upload Service
 * Handles uploading images to Supabase Storage
 * Images are stored as files in Supabase Storage buckets
 */

import { getBrowserAccessTokenForApi } from '../utils/authStorage';
import { randomAlphanumeric } from '../utils/secureRandom.js';

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  imageId?: string; // ID/path of the image in Supabase Storage
}

/**
 * Uploads a single image file to Supabase Storage
 * @param file - The image file to upload
 * @param folder - Optional folder path in storage bucket (e.g., 'vehicles', 'users')
 * @param userEmail - Optional email of the user uploading the image (for ownership tracking)
 * @returns Promise with upload result containing the image URL and path
 */
export const uploadImage = async (file: File, folder: string = 'vehicles', userEmail?: string): Promise<UploadResult> => {
  try {
    // Validate file first
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid image file'
      };
    }

    // Use Supabase Storage for image storage
    return await uploadToSupabaseStorage(file, folder, userEmail);
  } catch (error) {
    console.error('❌ Image upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image'
    };
  }
};

/**
 * Uploads multiple images
 * @param files - Array of image files
 * @param folder - Optional folder path
 * @param userEmail - Optional email of the user uploading the images (for ownership tracking)
 * @returns Promise with array of upload results
 */
export const uploadImages = async (files: File[], folder: string = 'vehicles', userEmail?: string): Promise<UploadResult[]> => {
  const uploadPromises = files.map(file => uploadImage(file, folder, userEmail));
  return Promise.all(uploadPromises);
};

function blobToBase64Payload(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(new Error('Failed to read audio blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a short voice note (WebM/MP4/etc.) via the same authenticated API as chat images.
 */
export async function uploadChatAudio(
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<UploadResult> {
  try {
    const fileBase64 = await blobToBase64Payload(blob);
    const { authenticatedFetch } = await import('../utils/authenticatedFetch');
    const res = await authenticatedFetch('/api/upload-image', {
      method: 'POST',
      body: JSON.stringify({
        fileBase64,
        fileName,
        mimeType: mimeType || blob.type || 'audio/webm',
        folder: 'chat-messages',
      }),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = (data.reason || data.error || `Upload failed (${res.status})`).toString();
      if (res.status === 401) {
        return {
          success: false,
          error: 'Your session may have expired. Please log out and log back in, then try again.',
        };
      }
      return { success: false, error: reason };
    }
    if (data.success && data.url) {
      return { success: true, url: data.url, imageId: data.imageId };
    }
    return { success: false, error: (data.reason || 'Upload failed').toString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Upload image via server API when Supabase session is missing (e.g. admin or API-only login).
 * Uses app JWT for auth; server uploads to Storage with service role.
 */
async function uploadViaApi(file: File, folder: string): Promise<UploadResult> {
  try {
    const resizedFile = await resizeImage(file, 1200, 800, 0.85);
    const dataUrl = await convertFileToBase64(resizedFile);
    const fileBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const { authenticatedFetch } = await import('../utils/authenticatedFetch');
    const res = await authenticatedFetch('/api/upload-image', {
      method: 'POST',
      body: JSON.stringify({
        fileBase64,
        fileName: resizedFile.name,
        mimeType: resizedFile.type || 'image/jpeg',
        folder,
      }),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = (data.reason || data.error || `Upload failed (${res.status})`).toString();
      if (res.status === 401) {
        return {
          success: false,
          error: 'Your session may have expired. Please log out and log back in, then try uploading again.',
        };
      }
      return { success: false, error: reason };
    }
    if (data.success && data.url) {
      return { success: true, url: data.url, imageId: data.imageId };
    }
    return {
      success: false,
      error: (data.reason || 'Upload failed').toString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ API image upload error:', err);
    return { success: false, error: msg };
  }
}

/**
 * Uploads image to Supabase Storage
 * Stores image as a file in Supabase Storage bucket
 * @param file - The image file to upload
 * @param folder - Folder path in storage bucket (e.g., 'vehicles', 'users')
 * @param userEmail - Optional email of the user uploading the image (for ownership tracking)
 */
async function uploadToSupabaseStorage(file: File, folder: string, _userEmail?: string): Promise<UploadResult> {
  try {
    console.log(`📤 Uploading image to Supabase Storage: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

    const isChatFolder = String(folder || '').startsWith('chat-messages');
    const apiToken = typeof window !== 'undefined' ? getBrowserAccessTokenForApi() : null;

    // Chat images/voice: prefer server upload when any app/Supabase JWT exists. Hybrid auth and
    // WebViews often have no hydrated @supabase/supabase-js session while /api still accepts the same token.
    if (isChatFolder && apiToken) {
      return await uploadViaApi(file, folder);
    }
    
    const { getSupabaseClient } = await import('../lib/supabase.js');
    const supabase = getSupabaseClient();
    
    // Check if user is authenticated (required for RLS policy)
    // First try to get the session (more reliable than getUser)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    let session = sessionData.session;
    
    // If no session, try to refresh it
    if (!session && !sessionError) {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshedSession) {
        session = refreshedSession;
      }
    }
    
    // If still no session, try getUser as fallback
    let user = session?.user;
    if (!user) {
      const { data: { user: getUserResult }, error: getUserError } = await supabase.auth.getUser();
      if (!getUserError && getUserResult) {
        user = getUserResult;
      }
    }
    
    if (!user) {
      let hasStoredProfile = false;
      if (typeof window !== 'undefined') {
        try {
          hasStoredProfile = !!JSON.parse(localStorage.getItem('reRideCurrentUser') || 'null');
        } catch {
          hasStoredProfile = false;
        }
      }

      const token = typeof window !== 'undefined' ? getBrowserAccessTokenForApi() : null;
      // App JWT or Supabase access token (server accepts both on /api/upload-image)
      if (token || hasStoredProfile) {
        if (process.env.NODE_ENV === 'development') {
          console.info(
            '📤 Upload via /api/upload-image (Supabase JS session not hydrated; app token or profile present).',
          );
        }
        return await uploadViaApi(file, folder);
      }

      console.error(
        '❌ Authentication check failed:',
        sessionError?.message || 'No Supabase session and no app token',
      );
      return {
        success: false,
        error: 'You must be logged in to upload images. Please log in and try again.',
      };
    }
    console.log(`✅ User authenticated: ${user.email}`);
    
    // Resize image to standard dimensions before uploading
    console.log('🔄 Resizing image to fit standard dimensions...');
    const resizedFile = await resizeImage(file, 1200, 800, 0.85);
    console.log(`✅ Image resized: ${(resizedFile.size / 1024).toFixed(2)} KB (original: ${(file.size / 1024).toFixed(2)} KB)`);
    
    // Generate unique file name
    const timestamp = Date.now();
    const randomStr = randomAlphanumeric(10);
    const fileExt = resizedFile.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}_${randomStr}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;
    
    // Upload to Supabase Storage
    console.log(`💾 Uploading to Supabase Storage: ${filePath}`);
    const { error } = await supabase.storage
      .from('Images') // Bucket name - must match exact case in Supabase (Images with capital I)
      .upload(filePath, resizedFile, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('❌ Supabase Storage upload error:', error);
      
      // Check if bucket doesn't exist
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        return {
          success: false,
          error: 'Storage bucket not found. Please create an "Images" bucket in Supabase Storage.'
        };
      }
      
      // Check for RLS policy errors
      if (error.message.includes('row-level security') || error.message.includes('violates row-level security policy') || error.message.includes('RLS')) {
        console.error('❌ RLS Policy Error Details:', {
          message: error.message,
          statusCode: (error as { statusCode?: number }).statusCode,
          user: user?.email,
          bucket: 'Images'
        });
        return {
          success: false,
          error: `Storage RLS policy error. You are authenticated (${user?.email}), but the upload was blocked by RLS policies. Please check: 1) The "Authenticated users can upload images" policy exists in Supabase, 2) The policy allows INSERT operations, 3) The bucket name matches exactly: "Images". See scripts/fix-storage-rls-policies.sql for the fix.`
        };
      }
      
      // Check for permission errors
      if (error.message.includes('permission') || error.message.includes('denied')) {
        return {
          success: false,
          error: 'Permission denied. Please check Supabase Storage policies. Run scripts/fix-storage-rls-policies.sql to fix this.'
        };
      }
      
      return {
        success: false,
        error: `Failed to upload image: ${error.message}`
      };
    }
    
    // Get public URL for the uploaded image
    const { data: urlData } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);
    
    const publicUrl = urlData.publicUrl;
    console.log(`✅ Image uploaded successfully: ${publicUrl}`);
    
    return {
      success: true,
      url: publicUrl,
      imageId: filePath
    };
  } catch (error) {
    console.error('❌ Supabase Storage upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      error: `Failed to upload image: ${errorMessage}`
    };
  }
}

/**
 * Normalizes MIME type to standard format
 * Converts non-standard types like 'image/jpg' to 'image/jpeg'
 * @param mimeType - The MIME type to normalize
 * @returns Normalized MIME type
 */
function normalizeMimeType(mimeType: string): string {
  // Normalize common non-standard MIME types
  const mimeTypeMap: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
    'image/webp': 'image/webp',
    'image/gif': 'image/gif',
  };
  
  const normalized = mimeType.toLowerCase().trim();
  return mimeTypeMap[normalized] || mimeType;
}

/**
 * Resizes an image to fit within specified dimensions while maintaining aspect ratio
 * @param file - The image file to resize
 * @param maxWidth - Maximum width (default: 1200px)
 * @param maxHeight - Maximum height (default: 800px)
 * @param quality - JPEG quality (0.1 to 1.0, default: 0.85)
 * @returns Promise with resized image as File
 */
async function resizeImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 800,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Normalize MIME type before using it (fixes 'image/jpg' -> 'image/jpeg')
        const normalizedMimeType = normalizeMimeType(file.type);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            // Create a new File from the blob with normalized MIME type
            const resizedFile = new File([blob], file.name, {
              type: normalizedMimeType,
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          },
          normalizedMimeType, // Use normalized MIME type for toBlob()
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      
      const result = e.target?.result;
      if (typeof result === 'string') {
        img.src = result;
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts file to base64 data URL
 */
async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => {
      reject(new Error('File read error'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates if a file is a valid image
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // Normalize MIME type before validation
  const normalizedType = normalizeMimeType(file.type);
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  // Check against normalized type
  if (!validTypes.includes(normalizedType)) {
    return { valid: false, error: 'Invalid image type. Please upload JPEG, PNG, WebP, or GIF.' };
  }
  
  // Increased max size to 5MB since we resize images before uploading
  // Images will be resized to max 1200x800px, so even large originals will be compressed
  const maxSize = 5 * 1024 * 1024; // 5MB (will be resized and compressed)
  
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size exceeds 5MB limit. Please use a smaller image file.' };
  }
  
  return { valid: true };
};

/**
 * Retrieves an image from Supabase Storage
 * @param imageId - The path/ID of the image in storage
 * @param folder - The folder where the image is stored (e.g., 'vehicles', 'users')
 * @returns Promise with the image URL or null if not found
 */
export const getImageFromDatabase = async (imageId: string, folder: string = 'vehicles'): Promise<string | null> => {
  try {
    const { getSupabaseClient } = await import('../lib/supabase.js');
    const supabase = getSupabaseClient();
    
    // If imageId is already a full path, use it directly
    // Otherwise, construct path from folder and imageId
    const filePath = imageId.includes('/') ? imageId : `${folder}/${imageId}`;
    
    // Get public URL
    const { data } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);
    
    return data.publicUrl || null;
  } catch (error) {
    console.error('Error retrieving image from Supabase Storage:', error);
    return null;
  }
};

