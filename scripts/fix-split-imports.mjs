import fs from 'fs';

function fixSharedImports(content) {
  return content
    .replace(/from '\.\.\/constants\//g, "from '../../constants/")
    .replace(/from '\.\.\/utils\//g, "from '../../utils/")
    .replace(/from '\.\.\/lib\//g, "from '../../lib/")
    .replace(/from '\.\.\/services\//g, "from '../../services/")
    .replace(/from '\.\.\/types\.js'/g, "from '../../types.js'")
    .replace(/from '\.\.\/vehicle-category\.js'/g, "from '../../vehicle-category.js'")
    .replace(/from '\.\.\/server\/sellerPlanLimits\.js'/g, "from '../sellerPlanLimits.js'")
    .replace(/from '\.\.\/server\/supabase-auth\.js'/g, "from '../supabase-auth.js'")
    .replace(/from '\.\.\/server\/supabase-admin-db\.js'/g, "from '../supabase-admin-db.js'")
    .replace(/from '\.\.\/server\/handlers\/admin\.js'/g, "from './admin.js'")
    .replace(/from '\.\.\/server\/handlers\/system\.js'/g, "from './system.js'")
    .replace(/from '\.\.\/server\/refresh-cookie\.js'/g, "from '../refresh-cookie.js'")
    .replace(/from '\.\/lib\/send-password-reset-email\.js'/g, "from '../../api/lib/send-password-reset-email.js'");
}

const sharedPath = 'server/handlers/main-api-shared.ts';
let shared = fs.readFileSync(sharedPath, 'utf8');
shared = fixSharedImports(shared);
shared = shared.replace(
  /\/\*\*[\s\S]*?api\/ \*\//,
  '/** Shared auth, services, and utilities for marketplace + platform API handlers. */',
);

const extraExports = `
export {
  getSupabaseAdminClient,
  PLAN_DETAILS,
  buildListingRenewalUpdates,
  computeListingExpiresAtForSeller,
  isSellerPlanExpired,
  validateListingRenewal,
  listingLimitGuardResponse,
  invalidateSellerPlanCache,
  resolveSellerPlanDetails,
  validateSellerCanCreateListing,
  validateSellerCanPublishListing,
  VehicleCategory,
  supabaseServiceProviderService,
  isRerideStaffPick,
  userRolesEqual,
  normalizeUserRoleString,
  verifySupabaseToken,
  readVehicleCatalogFromSupabase,
  writeVehicleCatalogToSupabase,
  sendInquiryNotificationToSeller,
  notifySellerInquiryChannels,
  parseVehicleIdentityFromBody,
  hasResolvableVehicleIdentity,
  normalizeVehiclesList,
  MUTATION_IDENTITY_REFRESH_MESSAGE,
  sanitizeVehicleMediaUrls,
  isPublicBuyListing,
  lookupVehicleSpecsFromCarQuery,
  participantIdMatchesAppUser,
  detectBufferContentType,
  adminRead,
  adminReadAll,
  adminCreate,
  adminUpdate,
  adminDelete,
  DB_PATHS,
  handleAdmin,
  seedUsers,
  seedVehicles,
  handleHealth,
  handleSystem,
  handleUtils,
  hashPassword,
  validatePassword,
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  validateUserInput,
  sanitizeObject,
  sanitizeString,
  validateEmail,
  verifyToken,
  rotateRefreshToken,
  isRefreshTokenRevoked,
  revokeRefreshToken,
  getSecurityConfig,
  attachApiCors,
  shouldSkipCsrfForCapacitorNative,
  logInfo,
  logWarn,
  logError,
  logSecurity,
  generateCsrfToken,
  validateCsrfToken,
  getCsrfCookieName,
  getPublicAppOriginForPasswordReset,
  sendPasswordResetEmail,
  checkUpstashRateLimit,
  checkLoginAllowed,
  recordFailedLogin,
  clearLoginLockout,
  resolveEffectiveApiPathname,
  appendRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  isCapacitorAppClient,
  refreshCookieMaxAgeSeconds,
  randomBytes,
  calculateDistance,
  config,
};
export type { UserType, VehicleType, VerificationStatus, TokenPayload, VehicleMutationResolve };
`;

if (!shared.includes('export {\n  getSupabaseAdminClient')) {
  shared = shared.replace(
    /export type \{ HandlerOptions, AuthResult, NormalizedUser \};/,
    extraExports + '\nexport type { HandlerOptions, AuthResult, NormalizedUser };',
  );
}

fs.writeFileSync(sharedPath, shared);

const marketplaceImports = `import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
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
  firstQueryParam,
  getSupabaseAdminClient,
  PLAN_DETAILS,
  buildListingRenewalUpdates,
  computeListingExpiresAtForSeller,
  isSellerPlanExpired,
  validateListingRenewal,
  listingLimitGuardResponse,
  invalidateSellerPlanCache,
  resolveSellerPlanDetails,
  validateSellerCanCreateListing,
  validateSellerCanPublishListing,
  VehicleCategory,
  supabaseServiceProviderService,
  isRerideStaffPick,
  userRolesEqual,
  normalizeUserRoleString,
  verifySupabaseToken,
  readVehicleCatalogFromSupabase,
  writeVehicleCatalogToSupabase,
  sendInquiryNotificationToSeller,
  notifySellerInquiryChannels,
  parseVehicleIdentityFromBody,
  hasResolvableVehicleIdentity,
  normalizeVehiclesList,
  MUTATION_IDENTITY_REFRESH_MESSAGE,
  sanitizeVehicleMediaUrls,
  isPublicBuyListing,
  lookupVehicleSpecsFromCarQuery,
  participantIdMatchesAppUser,
  detectBufferContentType,
  adminRead,
  adminReadAll,
  adminCreate,
  adminUpdate,
  adminDelete,
  DB_PATHS,
  handleAdmin,
  seedUsers,
  seedVehicles,
  hashPassword,
  validatePassword,
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  validateUserInput,
  sanitizeObject,
  sanitizeString,
  validateEmail,
  verifyToken,
  rotateRefreshToken,
  isRefreshTokenRevoked,
  revokeRefreshToken,
  logInfo,
  logWarn,
  logError,
  logSecurity,
  getPublicAppOriginForPasswordReset,
  sendPasswordResetEmail,
  checkLoginAllowed,
  recordFailedLogin,
  clearLoginLockout,
  appendRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  isCapacitorAppClient,
  refreshCookieMaxAgeSeconds,
  randomBytes,
  calculateDistance,
  type HandlerOptions,
  type AuthResult,
  type NormalizedUser,
  type UserType,
  type VehicleType,
  type VerificationStatus,
  type TokenPayload,
} from './main-api-shared.js';
`;

const platformImports = `import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE,
  getSupabaseErrorMessage,
  userService,
  vehicleService,
  conversationService,
  normalizeAuthActorEmail,
  authenticateRequest,
  authenticateRequestDual,
  requireAuth,
  requireAdmin,
  firstQueryParam,
  getSupabaseAdminClient,
  PLAN_DETAILS,
  participantIdMatchesAppUser,
  adminRead,
  adminReadAll,
  adminCreate,
  adminUpdate,
  adminDelete,
  DB_PATHS,
  sanitizeObject,
  sanitizeString,
  validateEmail,
  logInfo,
  logWarn,
  logError,
  type HandlerOptions,
  type AuthResult,
  type UserType,
  type VehicleType,
} from './main-api-shared.js';
`;

for (const [path, imports] of [
  ['server/handlers/marketplace-api.ts', marketplaceImports],
  ['server/handlers/platform-api.ts', platformImports],
]) {
  let body = fs.readFileSync(path, 'utf8');
  body = body.replace(/^import[\s\S]*?from '\.\/main-api-shared\.js';\nimport type[\s\S]*?from '\.\.\/\.\.\/types\.js';\n\n/, '');
  body = body.replace(/^import[\s\S]*?from '\.\/main-api-shared\.js';\n\n/, '');
  const handlerStart = body.indexOf('async function handle');
  if (handlerStart === -1) throw new Error('No handler in ' + path);
  const handlers = body.slice(handlerStart);
  const exportStart = handlers.lastIndexOf('\nexport {');
  const handlerCode = exportStart >= 0 ? handlers.slice(0, exportStart) : handlers;
  const exportBlock = exportStart >= 0 ? handlers.slice(exportStart) : '\n';
  fs.writeFileSync(path, imports + '\n' + handlerCode + exportBlock);
}

console.log('Fixed imports');
