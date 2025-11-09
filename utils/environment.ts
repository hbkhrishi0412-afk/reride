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
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }

  const globalEnv = (globalThis as any).__APP_ENV__;
  if (globalEnv && globalEnv[key]) {
    return globalEnv[key];
  }

  return fallback;
};

