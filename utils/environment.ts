export const isDevelopmentEnvironment = (): boolean => {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV !== 'production';
  }

  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).__APP_DEV__ === 'boolean') {
    return Boolean((globalThis as any).__APP_DEV__);
  }

  return false;
};

export const getEnvValue = (key: string, fallback: string = ''): string => {
  // Vite requires static references to environment variables for them to be included in the bundle
  // We need to directly access import.meta.env properties, not use dynamic keys
  try {
    // @ts-ignore - import.meta is a Vite-specific feature
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const env = import.meta.env;
      
      // Direct static access for Firebase variables (Vite will include these at build time)
      let viteValue: string | undefined;
      
      switch (key) {
        case 'VITE_FIREBASE_API_KEY':
          viteValue = env.VITE_FIREBASE_API_KEY;
          break;
        case 'VITE_FIREBASE_AUTH_DOMAIN':
          viteValue = env.VITE_FIREBASE_AUTH_DOMAIN;
          break;
        case 'VITE_FIREBASE_PROJECT_ID':
          viteValue = env.VITE_FIREBASE_PROJECT_ID;
          break;
        case 'VITE_FIREBASE_STORAGE_BUCKET':
          viteValue = env.VITE_FIREBASE_STORAGE_BUCKET;
          break;
        case 'VITE_FIREBASE_MESSAGING_SENDER_ID':
          viteValue = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
          break;
        case 'VITE_FIREBASE_APP_ID':
          viteValue = env.VITE_FIREBASE_APP_ID;
          break;
        default:
          // For other variables, try dynamic access (may not work in production)
          viteValue = env[key];
      }
      
      if (viteValue && typeof viteValue === 'string' && viteValue.trim() !== '') {
        return viteValue;
      }
    }
  } catch (e) {
    // import.meta not available (e.g., in Node.js environments)
    console.warn(`[getEnvValue] import.meta not available for key: ${key}`, e);
  }

  // Fallback to process.env (for server-side or Node.js)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }

  const globalEnv = (globalThis as any).__APP_ENV__;
  if (globalEnv && globalEnv[key]) {
    return globalEnv[key];
  }

  return fallback;
};

