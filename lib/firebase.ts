import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getEnvValue } from '../utils/environment';

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
let app: FirebaseApp;
let auth: Auth;

if (typeof window !== 'undefined') {
  // Only initialize on client side
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
}

export { app, auth };

