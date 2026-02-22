/**
 * Jest mock for utils/jwt-loader.ts. Uses require so no import.meta is needed.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
