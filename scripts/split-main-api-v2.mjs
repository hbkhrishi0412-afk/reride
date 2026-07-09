/**
 * Split api/main.ts into:
 * - server/main-api/shared.ts (auth, services, utilities)
 * - server/main-api/marketplace-handlers.ts
 * - server/main-api/platform-handlers.ts
 * - server/main-api/gateway.ts (middleware + createApiHandler)
 * - api/main.ts (thin marketplace entry)
 * - api/platform.ts (thin platform entry)
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const mainPath = path.join(ROOT, 'api/main.ts');
const lines = fs.readFileSync(mainPath, 'utf8').split(/\r?\n/);

const sharedLines = [...lines.slice(0, 502), ...lines.slice(1145, 1237)];
const marketplaceLines = lines.slice(1238, 6309);
const platformLines = lines.slice(6309, 9086);

function fixPathsForServerHandlers(content) {
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
    .replace(/from '\.\.\/server\/handlers\/admin\.js'/g, "from '../handlers/admin.js'")
    .replace(/from '\.\.\/server\/handlers\/system\.js'/g, "from '../handlers/system.js'")
    .replace(/from '\.\.\/server\/refresh-cookie\.js'/g, "from '../refresh-cookie.js'")
    .replace(/from '\.\/lib\/send-password-reset-email\.js'/g, "from '../../api/lib/send-password-reset-email.js'")
    .replace(
      /\/\*\*[\s\S]*?api\/ \*\//,
      '/** Shared state and utilities for main API handlers (extracted from api/main.ts). */',
    );
}

function prefixIdentifiers(body, prefix) {
  const skip = new Set([
    'if', 'else', 'return', 'await', 'async', 'function', 'const', 'let', 'var', 'new', 'try', 'catch',
    'throw', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'import', 'from', 'export',
    'type', 'interface', 'string', 'number', 'boolean', 'void', 'any', 'never', 'object', 'Record',
    'Array', 'Promise', 'Date', 'JSON', 'Math', 'Error', 'Map', 'Set', 'String', 'Number', 'Boolean',
    'Object', 'RegExp', 'Buffer', 'process', 'console', 'fetch', 'AbortSignal', 'URL', 'URLSearchParams',
    'req', 'res', 'error', 'data', 'body', 'result', 'response', 'status', 'success', 'reason', 'message',
  ]);

  const sharedNames = [
    'USE_SUPABASE', 'getSupabaseErrorMessage', 'userService', 'vehicleService', 'conversationService',
    'resolveVehicleForMutation', 'setVehicleApiCacheHeaders', 'calculateDistance', 'normalizeUser',
    'toPublicDirectoryUser', 'normalizeAuthActorEmail', 'authenticateRequest', 'authenticateRequestDual',
    'requireAuth', 'requireAdmin', 'getClientIP', 'checkTrackViewRateLimit', 'checkRateLimit',
    'cleanupVehicleCache', 'vehicleCache', 'VEHICLE_CACHE_TTL', 'storefrontAggregateCache',
    'STOREFRONT_AGGREGATE_CACHE_TTL_MS', 'firstQueryParam', 'mergeQueryStringFromRequestUrl',
    'errorToPublicMessage', 'getEffectivePathnameForErrorFallback', 'HandlerOptions', 'AuthResult',
    'NormalizedUser', 'UserType', 'VehicleType', 'VerificationStatus', 'VehicleMutationResolve',
    'getSupabaseAdminClient', 'PLAN_DETAILS', 'buildListingRenewalUpdates', 'computeListingExpiresAtForSeller',
    'isSellerPlanExpired', 'validateListingRenewal', 'listingLimitGuardResponse', 'invalidateSellerPlanCache',
    'resolveSellerPlanDetails', 'validateSellerCanCreateListing', 'validateSellerCanPublishListing',
    'VehicleCategory', 'supabaseUserService', 'supabaseServiceProviderService', 'isRerideStaffPick',
    'userRolesEqual', 'normalizeUserRoleString', 'verifySupabaseToken', 'readVehicleCatalogFromSupabase',
    'writeVehicleCatalogToSupabase', 'sendInquiryNotificationToSeller', 'notifySellerInquiryChannels',
    'parseVehicleIdentityFromBody', 'hasResolvableVehicleIdentity', 'normalizeVehiclesList',
    'MUTATION_IDENTITY_REFRESH_MESSAGE', 'sanitizeVehicleMediaUrls', 'isPublicBuyListing',
    'lookupVehicleSpecsFromCarQuery', 'participantIdMatchesAppUser', 'detectBufferContentType',
    'adminRead', 'adminReadAll', 'adminCreate', 'adminUpdate', 'adminDelete', 'DB_PATHS',
    'handleAdmin', 'seedUsers', 'seedVehicles', 'handleHealth', 'handleSystem', 'handleUtils',
    'hashPassword', 'validatePassword', 'generateAccessToken', 'generateRefreshToken',
    'generatePasswordResetToken', 'verifyPasswordResetToken', 'validateUserInput', 'sanitizeObject',
    'sanitizeString', 'validateEmail', 'verifyToken', 'rotateRefreshToken', 'isRefreshTokenRevoked',
    'revokeRefreshToken', 'getSecurityConfig', 'attachApiCors', 'shouldSkipCsrfForCapacitorNative',
    'logInfo', 'logWarn', 'logError', 'logSecurity', 'generateCsrfToken', 'validateCsrfToken',
    'getCsrfCookieName', 'getPublicAppOriginForPasswordReset', 'sendPasswordResetEmail',
    'checkUpstashRateLimit', 'checkLoginAllowed', 'recordFailedLogin', 'clearLoginLockout',
    'resolveEffectiveApiPathname', 'appendRefreshTokenCookie', 'clearRefreshTokenCookie',
    'getRefreshTokenFromRequest', 'isCapacitorAppClient', 'refreshCookieMaxAgeSeconds', 'randomBytes',
    'createHmac', 'randomInt', 'securityConfig', 'config',
  ];

  let out = body;
  for (const name of sharedNames.sort((a, b) => b.length - a.length)) {
    if (skip.has(name)) continue;
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), `${prefix}${name}`);
  }
  return out;
}

const sharedContent = fixPathsForServerHandlers(sharedLines.join('\n')) + `

export type { HandlerOptions, AuthResult, NormalizedUser, UserType, VehicleType, VerificationStatus, VehicleMutationResolve, TokenPayload };
export {
  USE_SUPABASE, getSupabaseErrorMessage, userService, vehicleService, conversationService,
  resolveVehicleForMutation, setVehicleApiCacheHeaders, calculateDistance, normalizeUser,
  toPublicDirectoryUser, normalizeAuthActorEmail, authenticateRequest, authenticateRequestDual,
  requireAuth, requireAdmin, getClientIP, checkTrackViewRateLimit, checkRateLimit,
  cleanupVehicleCache, vehicleCache, VEHICLE_CACHE_TTL, storefrontAggregateCache,
  STOREFRONT_AGGREGATE_CACHE_TTL_MS, firstQueryParam, mergeQueryStringFromRequestUrl,
  errorToPublicMessage, getEffectivePathnameForErrorFallback, config,
  getSupabaseAdminClient, PLAN_DETAILS, buildListingRenewalUpdates, computeListingExpiresAtForSeller,
  isSellerPlanExpired, validateListingRenewal, listingLimitGuardResponse, invalidateSellerPlanCache,
  resolveSellerPlanDetails, validateSellerCanCreateListing, validateSellerCanPublishListing,
  VehicleCategory, supabaseUserService, supabaseServiceProviderService, isRerideStaffPick,
  userRolesEqual, normalizeUserRoleString, verifySupabaseToken, readVehicleCatalogFromSupabase,
  writeVehicleCatalogToSupabase, sendInquiryNotificationToSeller, notifySellerInquiryChannels,
  parseVehicleIdentityFromBody, hasResolvableVehicleIdentity, normalizeVehiclesList,
  MUTATION_IDENTITY_REFRESH_MESSAGE, sanitizeVehicleMediaUrls, isPublicBuyListing,
  lookupVehicleSpecsFromCarQuery, participantIdMatchesAppUser, detectBufferContentType,
  adminRead, adminReadAll, adminCreate, adminUpdate, adminDelete, DB_PATHS,
  handleAdmin, seedUsers, seedVehicles, handleHealth, handleSystem, handleUtils,
  hashPassword, validatePassword, generateAccessToken, generateRefreshToken,
  generatePasswordResetToken, verifyPasswordResetToken, validateUserInput, sanitizeObject,
  sanitizeString, validateEmail, verifyToken, rotateRefreshToken, isRefreshTokenRevoked,
  revokeRefreshToken, getSecurityConfig, attachApiCors, shouldSkipCsrfForCapacitorNative,
  logInfo, logWarn, logError, logSecurity, generateCsrfToken, validateCsrfToken,
  getCsrfCookieName, getPublicAppOriginForPasswordReset, sendPasswordResetEmail,
  checkUpstashRateLimit, checkLoginAllowed, recordFailedLogin, clearLoginLockout,
  resolveEffectiveApiPathname, appendRefreshTokenCookie, clearRefreshTokenCookie,
  getRefreshTokenFromRequest, isCapacitorAppClient, refreshCookieMaxAgeSeconds, randomBytes,
  createHmac, randomInt, securityConfig,
};
`;

const marketplaceBody = prefixIdentifiers(marketplaceLines.join('\n'), 'core.');
const platformBody = prefixIdentifiers(platformLines.join('\n'), 'core.');

const marketplaceContent = `import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as core from './shared.js';

${marketplaceBody}

export {
  handleUsers,
  handleVehicles,
  handleVehicleSpecs,
  handleUploadImage,
  handleSeed,
  handleVehicleData,
};
`;

const platformContent = `import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as core from './shared.js';

${platformBody}

export {
  handleAI,
  handleContent,
  handlePlatformSettings,
  handleAuditLog,
  handleBusiness,
  handleConversations,
  handleNotifications,
  handleContentReports,
};
`;

fs.mkdirSync(path.join(ROOT, 'server/main-api'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'server/main-api/shared.ts'), sharedContent);
fs.writeFileSync(path.join(ROOT, 'server/main-api/marketplace-handlers.ts'), marketplaceContent);
fs.writeFileSync(path.join(ROOT, 'server/main-api/platform-handlers.ts'), platformContent);
console.log('Wrote server/main-api/{shared,marketplace-handlers,platform-handlers}.ts');
