/**
 * Load jsonwebtoken in ESM (Vite/Vercel) using createRequire(import.meta.url).
 * This file is not used in Jest; see __mocks__/utils/jwt-loader.ts and jest moduleNameMapper.
 */
import { createRequire } from 'module';

const requireFromImportMeta = createRequire(import.meta.url);
export const jwt = requireFromImportMeta('jsonwebtoken') as typeof import('jsonwebtoken');
