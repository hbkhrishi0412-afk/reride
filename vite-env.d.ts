/// <reference types="vite/client" />

// Optional dependency - types when not installed
declare module '@sentry/react' {
  export function init(options: Record<string, unknown>): void;
  export function captureException(error: Error, options?: Record<string, unknown>): void;
  export function captureMessage(message: string, level?: string): void;
  export function setUser(user: { id: string; email?: string } | null): void;
  export function setContext(key: string, context: Record<string, unknown>): void;
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
