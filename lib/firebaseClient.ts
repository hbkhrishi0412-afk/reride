// firebaseClient.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Support both Next.js (process.env.NEXT_PUBLIC_*) and Vite (import.meta.env.VITE_*)
const getEnv = (key: string): string | undefined => {
  // Next.js format
  if (typeof process !== 'undefined' && process.env && process.env[`NEXT_PUBLIC_${key}`]) {
    return process.env[`NEXT_PUBLIC_${key}`];
  }
  // Vite format
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as any).env;
    if (env && env[`VITE_${key}`]) {
      return env[`VITE_${key}`];
    }
  }
  return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY') || '',
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN') || '',
  databaseURL: getEnv('FIREBASE_DATABASE_URL') || '',
  projectId: getEnv('FIREBASE_PROJECT_ID') || '',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

