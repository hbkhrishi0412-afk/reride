import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleUsers,
  handleVehicles,
  handleVehicleSpecs,
  handleUploadImage,
  handleSeed,
  handleVehicleData,
} from './marketplace-handlers.js';
import {
  attachApiCors,
  authenticateRequestDual,
  checkRateLimit,
  checkUpstashRateLimit,
  errorToPublicMessage,
  firstQueryParam,
  getClientIP,
  getCsrfCookieName,
  generateCsrfToken,
  getEffectivePathnameForErrorFallback,
  handleAdmin,
  handleHealth,
  handleSystem,
  handleUtils,
  logError,
  logInfo,
  logWarn,
  mergeQueryStringFromRequestUrl,
  resolveEffectiveApiPathname,
  securityConfig,
  shouldSkipCsrfForCapacitorNative,
  validateCsrfToken,
  respondServiceUnavailable,
  type HandlerOptions,
} from './shared.js';

export async function dispatchMarketplaceRoute(
  req: VercelRequest,
  res: VercelResponse,
  pathname: string,
  handlerOptions: HandlerOptions,
): Promise<void | VercelResponse> {
  if (pathname.includes('/users') || pathname.endsWith('/users') || pathname === '/api/users' || pathname === '/users') {
    if (process.env.NODE_ENV !== 'production') {
      logInfo(`✅ Routing ${req.method} request to handleUsers handler`);
    }
    return await handleUsers(req, res, handlerOptions);
  }
  if (pathname.includes('/vehicles') || pathname.endsWith('/vehicles')) {
    try {
      return await handleVehicles(req, res, handlerOptions);
    } catch (error) {
      logError('⚠️ Error in handleVehicles wrapper:', error);
      if (firstQueryParam(req.query?.type) === 'data') {
        return respondServiceUnavailable(res, error, 'Vehicle catalog data is temporarily unavailable.');
      }
      throw error;
    }
  }
  if ((pathname.includes('/api/admin') || pathname === '/api/admin' || pathname.endsWith('/api/admin')) && !pathname.includes('/admin/login')) {
    return await handleAdmin(req, res, handlerOptions);
  }
  if ((pathname.includes('/health') || pathname.endsWith('/health')) && !pathname.includes('/db-health')) {
    return res.status(200).json({
      status: 'ok',
      message: 'API is running',
      timestamp: new Date().toISOString(),
    });
  }
  if (pathname.includes('/db-health') || pathname.endsWith('/db-health')) {
    return await handleHealth(req, res);
  }
  if (pathname.includes('/seed') || pathname.endsWith('/seed')) {
    return await handleSeed(req, res, handlerOptions);
  }
  if (pathname.includes('/vehicle-specs') || pathname.endsWith('/vehicle-specs')) {
    return await handleVehicleSpecs(req, res);
  }
  if (pathname.includes('/vehicle-pricing') || pathname.endsWith('/vehicle-pricing')) {
    const { handleVehiclePricing } = await import('../handlers/vehicle-pricing.js');
    return await handleVehiclePricing(req, res, handlerOptions);
  }
  if (pathname.includes('/geocode') || pathname.endsWith('/geocode')) {
    const { handleGeocode } = await import('../handlers/geocode.js');
    return await handleGeocode(req, res);
  }
  if (pathname.includes('/vehicle-trust') || pathname.endsWith('/vehicle-trust')) {
    const { handleVehicleTrust } = await import('../handlers/vehicle-trust.js');
    return await handleVehicleTrust(req, res, handlerOptions);
  }
  if (pathname.includes('/deals') || pathname.endsWith('/deals')) {
    const { handleDeals } = await import('../handlers/deals.js');
    return await handleDeals(req, res, handlerOptions);
  }
  if (pathname.includes('/complaints') || pathname.endsWith('/complaints')) {
    const { handleComplaints } = await import('../handlers/complaints.js');
    return await handleComplaints(req, res, handlerOptions);
  }
  if (pathname.includes('/vehicle-data') || pathname.endsWith('/vehicle-data')) {
    try {
      return await handleVehicleData(req, res, handlerOptions);
    } catch (error) {
      logError('⚠️ Error in handleVehicleData wrapper:', error);
      return respondServiceUnavailable(res, error, 'Vehicle catalog data is temporarily unavailable.');
    }
  }
  if (pathname.includes('/system') || pathname.endsWith('/system')) {
    return await handleSystem(req, res, handlerOptions);
  }
  if (pathname.includes('/utils') || pathname.endsWith('/utils') || pathname.includes('/test-connection') || pathname.includes('/test-firebase-writes')) {
    return await handleUtils(req, res, handlerOptions);
  }
  if (pathname.includes('/login') || pathname.endsWith('/login')) {
    const { handleLogin } = await import('../../api/login.js');
    return await handleLogin(req, res);
  }
  if (pathname.includes('/upload-image') || pathname.endsWith('/upload-image')) {
    return await handleUploadImage(req, res);
  }
  if (pathname.includes('/services') && !pathname.includes('/service-')) {
    const { handleServices } = await import('../../api/services.js');
    return await handleServices(req, res);
  }
  if (pathname.includes('/provider-services') || pathname.endsWith('/provider-services')) {
    const { handleProviderServices } = await import('../../api/provider-services.js');
    return await handleProviderServices(req, res);
  }
  if (pathname.includes('/service-providers/register') || pathname.endsWith('/service-providers/register')) {
    const { handleServiceProviderRegister } = await import('../../api/service-providers.js');
    return await handleServiceProviderRegister(req, res);
  }
  if (pathname.includes('/service-providers') || pathname.endsWith('/service-providers')) {
    const { handleServiceProviders } = await import('../../api/service-providers.js');
    return await handleServiceProviders(req, res);
  }
  if (pathname.includes('/service-requests') || pathname.endsWith('/service-requests')) {
    const { handleServiceRequests } = await import('../../api/service-requests.js');
    return await handleServiceRequests(req, res);
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({
    success: false,
    reason: 'API route not found',
    error: `No marketplace handler for ${pathname}`,
  });
}

export async function dispatchMarketplaceRewrite(
  req: VercelRequest,
  res: VercelResponse,
  checkPath: string,
  handlerOptions: HandlerOptions,
): Promise<void | VercelResponse> {
  if (checkPath.includes('/users') || checkPath.endsWith('/users')) {
    return await handleUsers(req, res, handlerOptions);
  }
  if (checkPath.includes('/vehicles') || checkPath.endsWith('/vehicles')) {
    return await handleVehicles(req, res, handlerOptions);
  }
  if (checkPath.includes('/login') || checkPath.endsWith('/login')) {
    const { handleLogin } = await import('../../api/login.js');
    return await handleLogin(req, res);
  }
  if (checkPath.includes('/upload-image') || checkPath.endsWith('/upload-image')) {
    return await handleUploadImage(req, res);
  }
  if (checkPath.includes('/deals') || checkPath.endsWith('/deals')) {
    const { handleDeals } = await import('../handlers/deals.js');
    return await handleDeals(req, res, handlerOptions);
  }
  if (checkPath.includes('/vehicle-trust') || checkPath.endsWith('/vehicle-trust')) {
    const { handleVehicleTrust } = await import('../handlers/vehicle-trust.js');
    return await handleVehicleTrust(req, res, handlerOptions);
  }
  if (checkPath.includes('/complaints') || checkPath.endsWith('/complaints')) {
    const { handleComplaints } = await import('../handlers/complaints.js');
    return await handleComplaints(req, res, handlerOptions);
  }
  if (checkPath.includes('/service-providers/register')) {
    const { handleServiceProviderRegister } = await import('../../api/service-providers.js');
    return await handleServiceProviderRegister(req, res);
  }
  return undefined;
}
