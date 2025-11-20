/**
 * Image Upload Service
 * Handles uploading images to cloud storage (Firebase Storage, Cloudinary, etc.)
 * 
 * For production, configure your preferred storage provider:
 * - Firebase Storage: Set VITE_FIREBASE_STORAGE_BUCKET
 * - Cloudinary: Set VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET
 */

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Uploads a single image file to cloud storage
 * @param file - The image file to upload
 * @param folder - Optional folder path in storage (e.g., 'vehicles', 'users')
 * @returns Promise with upload result containing the image URL
 */
export const uploadImage = async (file: File, folder: string = 'vehicles'): Promise<UploadResult> => {
  try {
    // Check if Firebase Storage is configured
    const firebaseStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
    if (firebaseStorageBucket && firebaseStorageBucket !== 'YOUR_PROJECT_ID.appspot.com') {
      return await uploadToFirebaseStorage(file, folder);
    }

    // Check if Cloudinary is configured
    const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (cloudinaryCloudName && cloudinaryUploadPreset) {
      return await uploadToCloudinary(file, folder);
    }

    // Fallback: Convert to base64 data URL (not recommended for production)
    // This is a temporary solution until cloud storage is configured
    console.warn('⚠️ No cloud storage configured. Using base64 encoding (not recommended for production).');
    return await convertToBase64(file);
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
 * Uploads to Firebase Storage
 */
async function uploadToFirebaseStorage(file: File, folder: string): Promise<UploadResult> {
  try {
    // Dynamic import to avoid loading Firebase in environments where it's not needed
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { app } = await import('../lib/firebase.js');
    
    const storage = getStorage(app);
    const fileName = `${folder}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    
    return { success: true, url };
  } catch (error) {
    console.error('Firebase Storage upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Firebase upload failed'
    };
  }
}

/**
 * Uploads to Cloudinary
 */
async function uploadToCloudinary(file: File, folder: string): Promise<UploadResult> {
  try {
    const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryUploadPreset);
    formData.append('folder', folder);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { success: true, url: data.secure_url };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cloudinary upload failed'
    };
  }
}

/**
 * Converts file to base64 data URL (fallback only)
 */
async function convertToBase64(file: File): Promise<UploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve({ success: true, url: result });
      } else {
        resolve({ success: false, error: 'Failed to convert file to base64' });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'File read error' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates if a file is a valid image
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid image type. Please upload JPEG, PNG, WebP, or GIF.' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size exceeds 5MB limit.' };
  }
  
  return { valid: true };
};

