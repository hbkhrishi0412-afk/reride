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

interface ImageData {
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
    // Convert file to base64
    const base64Data = await convertFileToBase64(file);
    
    // Generate unique image ID
    const imageId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Prepare image data for database
    const imageData: ImageData = {
      base64: base64Data,
      fileName: file.name,
      contentType: file.type,
      folder: folder,
      uploadedAt: new Date().toISOString(),
      size: file.size
    };
    
    // Import Firebase Realtime Database functions
    const { create } = await import('../lib/firebase-db.js');
    
    // Store image in Realtime Database under images/{folder}/{imageId}
    // The create function will create the path: images/{imageId}
    // We'll store folder info in the data itself
    await create(`images/${folder}`, imageData, imageId);
    
    // Return base64 data URL as the URL (can be used directly in img src)
    const dataUrl = base64Data;
    
    return {
      success: true,
      url: dataUrl,
      imageId: imageId
    };
  } catch (error) {
    console.error('Firebase Realtime Database upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image to database'
    };
  }
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
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  // Reduced max size to 2MB for Realtime Database (base64 increases size by ~33%)
  const maxSize = 2 * 1024 * 1024; // 2MB (becomes ~2.6MB as base64)
  
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid image type. Please upload JPEG, PNG, WebP, or GIF.' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size exceeds 2MB limit (for Realtime Database storage).' };
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

