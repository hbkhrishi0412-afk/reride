import fs from 'fs';

const src = fs.readFileSync('api/main.ts', 'utf8');
const lines = src.split(/\r?\n/);

const sharedHeader = lines.slice(0, 527).join('\n');
const utilsBlock = lines.slice(1165, 1257).join('\n');
const marketplaceHandlers = lines.slice(1258, 6335).join('\n');
const platformHandlers = lines.slice(6336, 9111).join('\n');

const sharedPath = 'server/handlers/main-api-shared.ts';
const marketplacePath = 'server/handlers/marketplace-api.ts';
const platformPath = 'server/handlers/platform-api.ts';

const sharedContent =
  sharedHeader.replace(
    /\/\*\*[\s\S]*?api\/ \*\//,
    '/** Shared setup for marketplace + platform API handlers (extracted from api/main.ts). */',
  ) +
  '\n\n' +
  utilsBlock +
  '\n';

const marketplaceImports = `import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE,
  getSupabaseErrorMessage,
  userService,
  vehicleService,
  normalizeUser,
  toPublicDirectoryUser,
  normalizeAuthActorEmail,
  authenticateRequest,
  authenticateRequestDual,
  requireAuth,
  requireAdmin,
  resolveVehicleForMutation,
  setVehicleApiCacheHeaders,
  checkTrackViewRateLimit,
  firstQueryParam,
  type HandlerOptions,
  type AuthResult,
  type NormalizedUser,
} from './main-api-shared.js';
import type { Vehicle as VehicleType } from '../../types.js';
`;

const platformImports = `import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE,
  getSupabaseAdminClient,
  normalizeAuthActorEmail,
  authenticateRequest,
  authenticateRequestDual,
  requireAuth,
  requireAdmin,
  firstQueryParam,
  type HandlerOptions,
  type AuthResult,
} from './main-api-shared.js';
`;

const sharedExports = `
export type { HandlerOptions, AuthResult, NormalizedUser };
export {
  USE_SUPABASE,
  getSupabaseErrorMessage,
  userService,
  vehicleService,
  conversationService,
  normalizeUser,
  toPublicDirectoryUser,
  normalizeAuthActorEmail,
  authenticateRequest,
  authenticateRequestDual,
  requireAuth,
  requireAdmin,
  resolveVehicleForMutation,
  setVehicleApiCacheHeaders,
  checkTrackViewRateLimit,
  getClientIP,
  checkRateLimit,
  firstQueryParam,
  mergeQueryStringFromRequestUrl,
  errorToPublicMessage,
  getEffectivePathnameForErrorFallback,
};
`;

const marketplaceContent =
  marketplaceImports +
  '\n' +
  marketplaceHandlers +
  '\n\nexport {\n  handleUsers,\n  handleVehicles,\n  handleVehicleSpecs,\n  handleUploadImage,\n  handleSeed,\n  handleVehicleData,\n};\n';

const platformContent =
  platformImports +
  '\n' +
  platformHandlers +
  '\n\nexport {\n  handleAI,\n  handleContent,\n  handlePlatformSettings,\n  handleAuditLog,\n  handleBusiness,\n  handleConversations,\n  handleNotifications,\n  handleContentReports,\n};\n';

fs.writeFileSync(sharedPath, sharedContent + sharedExports);
fs.writeFileSync(marketplacePath, marketplaceContent);
fs.writeFileSync(platformPath, platformContent);
console.log('Split complete:', sharedPath, marketplacePath, platformPath);
