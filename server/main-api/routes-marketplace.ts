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
  firstQueryParam,
  handleAdmin,
  handleHealth,
  handleSystem,
  handleUtils,
  logError,
  logInfo,
  respondServiceUnavailable,
  type HandlerOptions,
} from './shared.js';
import { matchesApiRoute } from '../../utils/api-path-routing.js';

export async function dispatchMarketplaceRoute(
  req: VercelRequest,
  res: VercelResponse,
  pathname: string,
  handlerOptions: HandlerOptions,
): Promise<void | VercelResponse> {
  // Admin before users/vehicles so /api/admin/* never shadows into public handlers.
  if (matchesApiRoute(pathname, '/api/admin') && !matchesApiRoute(pathname, '/api/admin/login')) {
    return await handleAdmin(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/users')) {
    if (process.env.NODE_ENV !== 'production') {
      logInfo(`✅ Routing ${req.method} request to handleUsers handler`);
    }
    return await handleUsers(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/vehicles')) {
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
  if (matchesApiRoute(pathname, '/api/health')) {
    return res.status(200).json({
      status: 'ok',
      message: 'API is running',
      timestamp: new Date().toISOString(),
    });
  }
  if (matchesApiRoute(pathname, '/api/db-health')) {
    return await handleHealth(req, res);
  }
  if (matchesApiRoute(pathname, '/api/seed')) {
    return await handleSeed(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/vehicle-specs')) {
    return await handleVehicleSpecs(req, res);
  }
  if (matchesApiRoute(pathname, '/api/vehicle-pricing')) {
    const { handleVehiclePricing } = await import('../handlers/vehicle-pricing.js');
    return await handleVehiclePricing(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/geocode')) {
    const { handleGeocode } = await import('../handlers/geocode.js');
    return await handleGeocode(req, res);
  }
  if (matchesApiRoute(pathname, '/api/vehicle-trust')) {
    const { handleVehicleTrust } = await import('../handlers/vehicle-trust.js');
    return await handleVehicleTrust(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/deals')) {
    const { handleDeals } = await import('../handlers/deals.js');
    return await handleDeals(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/complaints')) {
    const { handleComplaints } = await import('../handlers/complaints.js');
    return await handleComplaints(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/vehicle-data')) {
    try {
      return await handleVehicleData(req, res, handlerOptions);
    } catch (error) {
      logError('⚠️ Error in handleVehicleData wrapper:', error);
      return respondServiceUnavailable(res, error, 'Vehicle catalog data is temporarily unavailable.');
    }
  }
  if (matchesApiRoute(pathname, '/api/system')) {
    return await handleSystem(req, res, handlerOptions);
  }
  if (
    matchesApiRoute(pathname, '/api/utils') ||
    matchesApiRoute(pathname, '/api/test-connection') ||
    matchesApiRoute(pathname, '/api/test-firebase-writes')
  ) {
    return await handleUtils(req, res, handlerOptions);
  }
  if (matchesApiRoute(pathname, '/api/login')) {
    const { handleLogin } = await import('../handlers/login.js');
    return await handleLogin(req, res);
  }
  if (matchesApiRoute(pathname, '/api/upload-image')) {
    return await handleUploadImage(req, res);
  }
  if (matchesApiRoute(pathname, '/api/services')) {
    const { handleServices } = await import('../handlers/services.js');
    return await handleServices(req, res);
  }
  if (matchesApiRoute(pathname, '/api/provider-services')) {
    const { handleProviderServices } = await import('../handlers/provider-services.js');
    return await handleProviderServices(req, res);
  }
  if (matchesApiRoute(pathname, '/api/service-providers/register')) {
    const { handleServiceProviderRegister } = await import('../handlers/service-providers.js');
    return await handleServiceProviderRegister(req, res);
  }
  if (matchesApiRoute(pathname, '/api/service-providers')) {
    const { handleServiceProviders } = await import('../handlers/service-providers.js');
    return await handleServiceProviders(req, res);
  }
  if (matchesApiRoute(pathname, '/api/service-requests')) {
    const { handleServiceRequests } = await import('../handlers/service-requests.js');
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
  if (matchesApiRoute(checkPath, '/api/admin') && !matchesApiRoute(checkPath, '/api/admin/login')) {
    return await handleAdmin(req, res, handlerOptions);
  }
  if (matchesApiRoute(checkPath, '/api/users')) {
    return await handleUsers(req, res, handlerOptions);
  }
  if (matchesApiRoute(checkPath, '/api/vehicles')) {
    return await handleVehicles(req, res, handlerOptions);
  }
  if (matchesApiRoute(checkPath, '/api/login')) {
    const { handleLogin } = await import('../handlers/login.js');
    return await handleLogin(req, res);
  }
  if (matchesApiRoute(checkPath, '/api/upload-image')) {
    return await handleUploadImage(req, res);
  }
  if (matchesApiRoute(checkPath, '/api/deals')) {
    const { handleDeals } = await import('../handlers/deals.js');
    return await handleDeals(req, res, handlerOptions);
  }
  if (matchesApiRoute(checkPath, '/api/vehicle-trust')) {
    const { handleVehicleTrust } = await import('../handlers/vehicle-trust.js');
    return await handleVehicleTrust(req, res, handlerOptions);
  }
  if (matchesApiRoute(checkPath, '/api/complaints')) {
    const { handleComplaints } = await import('../handlers/complaints.js');
    return await handleComplaints(req, res, handlerOptions);
  }
  if (matchesApiRoute(checkPath, '/api/service-providers/register')) {
    const { handleServiceProviderRegister } = await import('../handlers/service-providers.js');
    return await handleServiceProviderRegister(req, res);
  }
  if (matchesApiRoute(checkPath, '/api/service-providers')) {
    const { handleServiceProviders } = await import('../handlers/service-providers.js');
    return await handleServiceProviders(req, res);
  }
  if (matchesApiRoute(checkPath, '/api/service-requests')) {
    const { handleServiceRequests } = await import('../handlers/service-requests.js');
    return await handleServiceRequests(req, res);
  }
  if (matchesApiRoute(checkPath, '/api/services')) {
    const { handleServices } = await import('../handlers/services.js');
    return await handleServices(req, res);
  }
  if (matchesApiRoute(checkPath, '/api/provider-services')) {
    const { handleProviderServices } = await import('../handlers/provider-services.js');
    return await handleProviderServices(req, res);
  }
  return undefined;
}
