/**
 * Marketplace API — users, vehicles, listings, deals, car services, auth.
 * Platform routes (chat, payments, AI, etc.) are handled by api/platform.ts.
 */
export { config } from '../server/main-api/shared.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { attachApiCors } from '../server/main-api/shared.js';
import { createApiHandler } from '../server/main-api/gateway.js';

const marketplaceHandler = createApiHandler('marketplace');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    attachApiCors(req, res);
  } catch {
    const rawOrigin = req.headers?.origin;
    const origin = typeof rawOrigin === 'string' ? rawOrigin : Array.isArray(rawOrigin) ? rawOrigin[0] : undefined;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
  }
  return marketplaceHandler(req, res);
}
