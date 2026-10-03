/**
 * Platform API — conversations, notifications, payments, AI, content, settings.
 * Marketplace routes (users, vehicles, etc.) are handled by api/main.ts.
 */
export { config } from '../server/main-api/shared.js';
import { createApiHandler } from '../server/main-api/gateway.js';

export default createApiHandler('platform');
