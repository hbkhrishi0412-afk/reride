import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getEnvValue } from '../utils/environment.js';

// Helper to detect if we're in production
const isProduction = (): boolean => {
  if (typeof window !== 'undefined') {
    // Check if we're on Vercel production domain
    const hostname = window.location.hostname;
    return hostname.includes('vercel.app') || hostname.includes('reride.co.in') || 
           (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'production');
  }
  return false;
};

// Firebase configuration
// Note: These are client-safe keys - they identify your Firebase project
// IMPORTANT: Direct static access to import.meta.env is required for Vite to include these in the build
// Vite statically analyzes the code and only includes env vars that are directly referenced
// Using direct references ensures Vite includes them at build time
const firebaseConfig = {
  // Direct static access - Vite will replace these at build time with actual values
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || getEnvValue('VITE_FIREBASE_API_KEY', 'YOUR_API_KEY'),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || getEnvValue('VITE_FIREBASE_AUTH_DOMAIN', 'YOUR_PROJECT_ID.firebaseapp.com'),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || getEnvValue('VITE_FIREBASE_PROJECT_ID', 'YOUR_PROJECT_ID'),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || getEnvValue('VITE_FIREBASE_STORAGE_BUCKET', 'YOUR_PROJECT_ID.appspot.com'),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID', 'YOUR_MESSAGING_SENDER_ID'),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || getEnvValue('VITE_FIREBASE_APP_ID', 'YOUR_APP_ID')
};

// Debug logging in development to help troubleshoot
if (typeof window !== 'undefined' && (import.meta.env?.MODE === 'development' || import.meta.env?.DEV)) {
  console.log('🔍 Firebase Config Debug:', {
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
    authDomain: firebaseConfig.authDomain || 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING',
    storageBucket: firebaseConfig.storageBucket || 'MISSING',
    messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING',
    appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 10)}...` : 'MISSING',
    envMode: import.meta.env?.MODE,
    hasImportMeta: typeof import.meta !== 'undefined',
    envKeys: typeof import.meta !== 'undefined' && import.meta.env ? Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE')) : []
  });
}

// Initialize Firebase
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let initializationError: string | undefined;

if (typeof window !== 'undefined') {
  try {
    // Only initialize on client side
    if (!getApps().length) {
      // Validate that we have proper Firebase configuration
      const hasValidConfig = firebaseConfig.apiKey && 
                            firebaseConfig.apiKey !== 'YOUR_API_KEY' && 
                            firebaseConfig.projectId && 
                            firebaseConfig.projectId !== 'YOUR_PROJECT_ID';
      
      if (hasValidConfig) {
        app = initializeApp(firebaseConfig);
      } else {
        const envGuidance = isProduction() 
          ? 'Please set Firebase environment variables in your Vercel project settings (Settings → Environment Variables). Add all 6 variables with VITE_ prefix: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID'
          : 'Please check your .env.local file in the project root and ensure all Firebase variables are set.';
        
        initializationError = `Firebase configuration is missing or incomplete. ${envGuidance}`;
        console.warn('⚠️', initializationError);
      }
    } else {
      app = getApps()[0];
    }
    
    if (app) {
      auth = getAuth(app);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    initializationError = `Firebase initialization failed: ${errorMessage}`;
    console.error('❌ Firebase initialization error:', error);
  }
}

// Export error message for use in components
export const getFirebaseInitError = (): string | undefined => {
  if (!auth && initializationError) {
    return initializationError;
  }
  return undefined;
};

export { app, auth };

