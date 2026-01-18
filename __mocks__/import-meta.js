// Mock for import.meta used in Jest tests
export const importMeta = {
  env: {
    MODE: 'test',
    DEV: true,
    PROD: false,
    VITE_FIREBASE_API_KEY: 'test-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
    VITE_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    VITE_FIREBASE_APP_ID: '1:123456789:web:test',
    VITE_FIREBASE_DATABASE_URL: 'https://test-project.firebaseio.com',
  },
};


















