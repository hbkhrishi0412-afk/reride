export const isDevelopmentEnvironment = jest.fn(() => false);
export const getEnvValue = jest.fn((_: string, fallback?: string) => fallback ?? '');
