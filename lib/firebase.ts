import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

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
// CRITICAL: Direct static access to import.meta.env is required for Vite to include these in the build
// Vite statically analyzes the code and only includes env vars that are directly referenced
// DO NOT use dynamic keys or helper functions - use direct property access only
// Note: These are client-safe keys - they identify your Firebase project
const firebaseConfig = {
  // Direct static access - Vite will replace these at build time with actual values
  // If variables are not set, they will be undefined, which we handle in validation
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  // Database URL is required for Realtime Database
  // CRITICAL: This must be VITE_FIREBASE_DATABASE_URL (not FIREBASE_DATABASE_URL) for client-side
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || ''
};

// Helper to check if a value looks like a real Firebase config (not a placeholder)
const isValidFirebaseValue = (value: string | undefined, type: 'apiKey' | 'projectId' | 'authDomain' | 'storageBucket' | 'messagingSenderId' | 'appId'): boolean => {
  if (!value || typeof value !== 'string' || value.trim() === '') return false;
  
  // Check for placeholder values
  if (value.includes('YOUR_') || value === 'undefined' || value === 'null') return false;
  
  // Type-specific validation
  switch (type) {
    case 'apiKey':
      // Firebase API keys typically start with 'AIza' and are ~39 chars
      return value.startsWith('AIza') && value.length > 30;
    case 'projectId':
      // Project IDs are alphanumeric with hyphens, typically 6-30 chars
      return /^[a-z0-9-]+$/.test(value) && value.length >= 6 && !value.includes('YOUR');
    case 'authDomain':
      // Auth domains end with .firebaseapp.com
      return value.includes('.firebaseapp.com') && !value.includes('YOUR');
    case 'storageBucket':
      // Storage buckets end with .appspot.com or .firebasestorage.app (newer format)
      return (value.includes('.appspot.com') || value.includes('.firebasestorage.app')) && !value.includes('YOUR');
    case 'messagingSenderId':
      // Sender IDs are numeric strings
      return /^\d+$/.test(value) && value.length >= 10;
    case 'appId':
      // App IDs are typically in format 1:xxxxx:web:xxxxx
      return value.includes(':') && value.length > 20 && !value.includes('YOUR');
    default:
      return true;
  }
};

// Debug logging for both development and production to help troubleshoot
if (typeof window !== 'undefined') {
  const isDev = import.meta.env?.MODE === 'development' || import.meta.env?.DEV;
  const isProd = window.location.hostname.includes('vercel.app') || window.location.hostname.includes('reride.co.in');
  
  // Always log in production if there's an issue, or always in dev
  if (isDev || isProd) {
    const debugInfo = {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 15)}...` : 'MISSING',
      authDomain: firebaseConfig.authDomain || 'MISSING',
      projectId: firebaseConfig.projectId || 'MISSING',
      storageBucket: firebaseConfig.storageBucket || 'MISSING',
      messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING',
      appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 15)}...` : 'MISSING',
      envMode: import.meta.env?.MODE,
      isProduction: isProd,
      isValid: {
        apiKey: isValidFirebaseValue(firebaseConfig.apiKey, 'apiKey'),
        projectId: isValidFirebaseValue(firebaseConfig.projectId, 'projectId'),
        authDomain: isValidFirebaseValue(firebaseConfig.authDomain, 'authDomain'),
        storageBucket: isValidFirebaseValue(firebaseConfig.storageBucket, 'storageBucket'),
        messagingSenderId: isValidFirebaseValue(firebaseConfig.messagingSenderId, 'messagingSenderId'),
        appId: isValidFirebaseValue(firebaseConfig.appId, 'appId')
      },
      // Show which env vars are actually available
      availableEnvVars: typeof import.meta !== 'undefined' && import.meta.env 
        ? Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE')).map(k => ({
            key: k,
            hasValue: !!(import.meta.env as any)[k] && (import.meta.env as any)[k] !== 'undefined'
          }))
        : [],
      // Check for database URL specifically
      databaseURL: firebaseConfig.databaseURL ? `${firebaseConfig.databaseURL.substring(0, 30)}...` : 'MISSING',
      hasDatabaseURL: !!firebaseConfig.databaseURL && firebaseConfig.databaseURL.includes('firebasedatabase')
    };
    
    if (isDev) {
      console.log('🔍 Firebase Config Debug (Dev):', debugInfo);
    } else if (isProd) {
      // In production, only log if there's a problem
      const hasInvalidValues = Object.values(debugInfo.isValid).some(v => !v);
      if (hasInvalidValues) {
        console.warn('⚠️ Firebase Config Issue (Production):', debugInfo);
        console.warn('💡 Make sure all 6 Firebase environment variables are set in Vercel and a new deployment was triggered after setting them.');
      }
    }
  }
}

// Initialize Firebase
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let initializationError: string | undefined;

if (typeof window !== 'undefined') {
  try {
    // Only initialize on client side
    if (!getApps().length) {
      // Validate that we have proper Firebase configuration using improved validation
      const isValidApiKey = isValidFirebaseValue(firebaseConfig.apiKey, 'apiKey');
      const isValidProjectId = isValidFirebaseValue(firebaseConfig.projectId, 'projectId');
      const isValidAuthDomain = isValidFirebaseValue(firebaseConfig.authDomain, 'authDomain');
      const isValidStorageBucket = isValidFirebaseValue(firebaseConfig.storageBucket, 'storageBucket');
      const isValidMessagingSenderId = isValidFirebaseValue(firebaseConfig.messagingSenderId, 'messagingSenderId');
      const isValidAppId = isValidFirebaseValue(firebaseConfig.appId, 'appId');
      
      const hasValidConfig = isValidApiKey && isValidProjectId && isValidAuthDomain && 
                            isValidStorageBucket && isValidMessagingSenderId && isValidAppId;
      
      if (hasValidConfig) {
        try {
          app = initializeApp(firebaseConfig);
          console.log('✅ Firebase initialized successfully');
        } catch (initError) {
          const errorMsg = initError instanceof Error ? initError.message : String(initError);
          initializationError = `Firebase initialization failed: ${errorMsg}`;
          console.error('❌ Firebase initialization error:', initError);
        }
      } else {
        // Build detailed error message
        const missingFields: string[] = [];
        if (!isValidApiKey) missingFields.push('VITE_FIREBASE_API_KEY');
        if (!isValidProjectId) missingFields.push('VITE_FIREBASE_PROJECT_ID');
        if (!isValidAuthDomain) missingFields.push('VITE_FIREBASE_AUTH_DOMAIN');
        if (!isValidStorageBucket) missingFields.push('VITE_FIREBASE_STORAGE_BUCKET');
        if (!isValidMessagingSenderId) missingFields.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
        if (!isValidAppId) missingFields.push('VITE_FIREBASE_APP_ID');
        
        const prod = isProduction();
        const baseMessage = prod
          ? 'Firebase configuration is missing or incomplete. Please set Firebase environment variables in your Vercel project settings (Settings → Environment Variables).'
          : 'Firebase configuration is missing or incomplete. Please check your .env.local file in the project root.';
        
        const missingList = missingFields.length > 0 
          ? ` Missing or invalid: ${missingFields.join(', ')}.`
          : '';
        
        const instructions = prod
          ? ' Add all 7 variables with VITE_ prefix: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID, VITE_FIREBASE_DATABASE_URL. After setting variables, trigger a new deployment in Vercel (Deployments → Redeploy).'
          : ' Ensure all Firebase variables are set correctly, including VITE_FIREBASE_DATABASE_URL.';
        
        initializationError = `${baseMessage}${missingList}${instructions}`;
        console.warn('⚠️', initializationError);
        
        // Additional production debugging
        if (prod) {
          console.warn('🔍 Production Debug Info:', {
            hostname: window.location.hostname,
            envMode: import.meta.env?.MODE,
            hasImportMeta: typeof import.meta !== 'undefined',
            availableVars: typeof import.meta !== 'undefined' && import.meta.env
              ? Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE'))
              : []
          });
        }
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

