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
  // Check Vite's import.meta.env first (for client-side Vite apps)
  try {
    // @ts-ignore - import.meta is a Vite-specific feature
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const viteValue = import.meta.env[key];
      if (viteValue && typeof viteValue === 'string' && viteValue.trim() !== '') {
        return viteValue;
      }
    }
  } catch (e) {
    // import.meta not available (e.g., in Node.js environments)
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

