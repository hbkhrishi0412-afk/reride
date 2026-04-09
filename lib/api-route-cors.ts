import type { VercelRequest, VercelResponse } from '@vercel/node';
import { attachApiCors } from '../utils/attach-api-cors.js';

/**
 * Apply CORS + security headers for Vercel serverless handlers.
 *
 * Returns true when the request is fully handled (OPTIONS/HEAD).
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  attachApiCors(req, res);

  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', '0');
    }
    res.status(200).end();
    return true;
  }

  return false;
}
