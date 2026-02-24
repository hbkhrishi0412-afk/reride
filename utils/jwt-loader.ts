/**
 * Load jsonwebtoken in ESM. Use default import so serverless (Vercel) resolves
 * node_modules from the function root. Jest uses __mocks__/utils/jwt-loader.ts via moduleNameMapper.
 */
import jwtModule from 'jsonwebtoken';
export const jwt = jwtModule as typeof import('jsonwebtoken');
