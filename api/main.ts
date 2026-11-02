/**
 * Marketplace API — users, vehicles, listings, deals, car services, auth.
 * Platform routes (chat, payments, AI, etc.) are handled by api/platform.ts.
 * 15mb body limit is for base64 image uploads on seller/chat paths only.
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};
import { createApiHandler } from '../server/main-api/gateway.js';

export default createApiHandler('marketplace');
