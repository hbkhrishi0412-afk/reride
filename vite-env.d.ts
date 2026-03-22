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
  readonly VITE_APP_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_PRODUCTION_ORIGIN?: string
  /** When `true` and build `MODE` is `development`, Capacitor uses your PC dev API (see `getMobileLocalApiOrigin`). */
  readonly VITE_MOBILE_LOCAL_DEV?: string
  /** Port for local dev API (default 3001, same as dev-api-server.js). */
  readonly VITE_LOCAL_API_PORT?: string
  readonly VITE_GA_MEASUREMENT_ID?: string
  /** When `messagebot`, phone OTP uses MessageBot SMS + server JWT (see .env.example). Omit or other value = Supabase SMS. */
  readonly VITE_OTP_SMS_PROVIDER?: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
