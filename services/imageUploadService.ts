/**
 * Image Upload Service
 * Handles uploading images to Firebase Realtime Database
 * Images are stored as base64 data URLs in the database
 */

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  imageId?: string; // ID of the image in Realtime Database
}

interface ImageData extends Record<string, unknown> {
  base64: string;
  fileName: string;
  contentType: string;
  folder: string;
  uploadedAt: string;
  size: number;
}

/**
 * Uploads a single image file to Firebase Realtime Database
 * @param file - The image file to upload
 * @param folder - Optional folder path in database (e.g., 'vehicles', 'users')
 * @returns Promise with upload result containing the image data URL and ID
 */
export const uploadImage = async (file: File, folder: string = 'vehicles'): Promise<UploadResult> => {
  try {
    // Validate file first
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid image file'
      };
    }

    // Use Firebase Realtime Database for image storage
    return await uploadToFirebaseRealtimeDB(file, folder);
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
 * @returns Promise with array of upload results
 */
export const uploadImages = async (files: File[], folder: string = 'vehicles'): Promise<UploadResult[]> => {
  const uploadPromises = files.map(file => uploadImage(file, folder));
  return Promise.all(uploadPromises);
};

/**
 * Uploads image to Firebase Realtime Database
 * Converts image to base64 and stores it in the database
 */
async function uploadToFirebaseRealtimeDB(file: File, folder: string): Promise<UploadResult> {
  try {
    console.log(`📤 Uploading image to Realtime Database: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    // Resize image to standard dimensions before uploading
    console.log('🔄 Resizing image to fit standard dimensions...');
    const resizedFile = await resizeImage(file, 1200, 800, 0.85);
    console.log(`✅ Image resized: ${(resizedFile.size / 1024).toFixed(2)} KB (original: ${(file.size / 1024).toFixed(2)} KB)`);
    
    // Convert resized file to base64
    const base64Data = await convertFileToBase64(resizedFile);
    
    // Check base64 size (base64 is ~33% larger than original)
    const base64Size = base64Data.length;
    const maxBase64Size = 1.5 * 1024 * 1024; // 1.5MB base64 limit
    
    if (base64Size > maxBase64Size) {
      console.warn(`⚠️ Image base64 size (${(base64Size / 1024).toFixed(2)} KB) exceeds recommended limit`);
      // Still allow it, but warn - Firebase has 16MB limit per node
    }
    
    // Generate unique image ID
    const imageId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Prepare image data for database
    const imageData: ImageData = {
      base64: base64Data,
      fileName: file.name,
      contentType: resizedFile.type,
      folder: folder,
      uploadedAt: new Date().toISOString(),
      size: resizedFile.size // Use resized file size
    };
    
    // Import Firebase Realtime Database functions
    const { create, isDatabaseAvailable } = await import('../lib/firebase-db.js');
    
    // Check if database is available
    if (!isDatabaseAvailable()) {
      throw new Error('Firebase Realtime Database is not available. Please check your configuration.');
    }
    
    // Store image in Realtime Database under images/{folder}/{imageId}
    console.log(`💾 Storing image in database: images/${folder}/${imageId}`);
    await create(`images/${folder}`, imageData, imageId);
    console.log(`✅ Image stored successfully: ${imageId}`);
    
    // Return base64 data URL as the URL (can be used directly in img src)
    // NOTE: For large vehicles with many images, consider storing only imageId references
    // and fetching images on-demand to avoid exceeding Firebase's 16MB node limit
    const dataUrl = base64Data;
    
    // Log warning if base64 is very large (could cause vehicle object to exceed limits)
    if (base64Size > 500 * 1024) { // 500KB base64
      console.warn(`⚠️ Large image base64 (${(base64Size / 1024).toFixed(2)} KB). Consider limiting number of images per vehicle to avoid size limits.`);
    }
    
    return {
      success: true,
      url: dataUrl,
      imageId: imageId
    };
  } catch (error) {
    console.error('❌ Firebase Realtime Database upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more specific error messages
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
      return {
        success: false,
        error: 'Permission denied. Please check Firebase database rules for image uploads.'
      };
    }
    
    if (errorMessage.includes('not available') || errorMessage.includes('configuration')) {
      return {
        success: false,
        error: 'Database not available. Please check Firebase configuration.'
      };
    }
    
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
 * Retrieves an image from Firebase Realtime Database
 * @param imageId - The ID of the image
 * @param folder - The folder where the image is stored (e.g., 'vehicles', 'users')
 * @returns Promise with the image data URL or null if not found
 */
export const getImageFromDatabase = async (imageId: string, folder: string = 'vehicles'): Promise<string | null> => {
  try {
    const { read } = await import('../lib/firebase-db.js');
    const imageData = await read<ImageData>(`images/${folder}`, imageId);
    
    if (imageData && imageData.base64) {
      return imageData.base64;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving image from database:', error);
    return null;
  }
};

