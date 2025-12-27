import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getEnvValue } from '../utils/environment.js';

// Firebase configuration
// Note: These are client-safe keys - they identify your Firebase project
const firebaseConfig = {
  apiKey: getEnvValue('VITE_FIREBASE_API_KEY', 'YOUR_API_KEY'),
  authDomain: getEnvValue('VITE_FIREBASE_AUTH_DOMAIN', 'YOUR_PROJECT_ID.firebaseapp.com'),
  projectId: getEnvValue('VITE_FIREBASE_PROJECT_ID', 'YOUR_PROJECT_ID'),
  storageBucket: getEnvValue('VITE_FIREBASE_STORAGE_BUCKET', 'YOUR_PROJECT_ID.appspot.com'),
  messagingSenderId: getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID', 'YOUR_MESSAGING_SENDER_ID'),
  appId: getEnvValue('VITE_FIREBASE_APP_ID', 'YOUR_APP_ID')
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let auth: Auth | undefined;

if (typeof window !== 'undefined') {
  try {
    // Only initialize on client side
    if (!getApps().length) {
      // Validate that we have proper Firebase configuration
      if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY' && 
          firebaseConfig.projectId && firebaseConfig.projectId !== 'YOUR_PROJECT_ID') {
        app = initializeApp(firebaseConfig);
      } else {
        console.warn('⚠️ Firebase configuration is missing or incomplete. Please check your .env.local file.');
      }
    } else {
      app = getApps()[0];
    }
    
    if (app) {
      auth = getAuth(app);
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
}

export { app, auth };

