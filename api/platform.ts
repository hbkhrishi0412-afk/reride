/**
 * Platform API — conversations, notifications, payments, AI, content, settings.
 * Marketplace routes (users, vehicles, etc.) are handled by api/main.ts.
 */
export { config } from '../server/main-api/shared.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { attachApiCors } from '../server/main-api/shared.js';
import { createApiHandler } from '../server/main-api/gateway.js';

const platformHandler = createApiHandler('platform');

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
  return platformHandler(req, res);
}
