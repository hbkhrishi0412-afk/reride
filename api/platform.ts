/**
 * Platform API — conversations, notifications, payments, AI, content, settings.
 * Marketplace routes (users, vehicles, etc.) are handled by api/main.ts.
 * Keep body limit small — no image uploads on this bundle.
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
import { createApiHandler } from '../server/main-api/gateway.js';

export default createApiHandler('platform');
