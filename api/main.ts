/**
 * Marketplace API — users, vehicles, listings, deals, car services, auth.
 * Platform routes (chat, payments, AI, etc.) are handled by api/platform.ts.
 */
export { config } from '../server/main-api/shared.js';
import { createApiHandler } from '../server/main-api/gateway.js';

export default createApiHandler('marketplace');
