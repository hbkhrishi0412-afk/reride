import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleAI,
  handleAuditLog,
  handleBusiness,
  handleContent,
  handleContentReports,
  handleConversations,
  handleNotifications,
  handlePlatformSettings,
} from './platform-handlers.js';
import { ensureMutableRequestQuery, logInfo, type HandlerOptions } from './shared.js';
import { pathHasSegment } from '../../utils/api-path-routing.js';

function setContentQueryType(req: VercelRequest, type: string): void {
  ensureMutableRequestQuery(req);
  (req.query as Record<string, string | string[] | undefined>).type = type;
}

export async function dispatchPlatformRoute(
  req: VercelRequest,
  res: VercelResponse,
  pathname: string,
  handlerOptions: HandlerOptions,
): Promise<void | VercelResponse> {
  if (pathname.includes('/ai') || pathname.endsWith('/ai') || pathname.includes('/gemini')) {
    return await handleAI(req, res, handlerOptions);
  }
  if (pathname.includes('/faqs') || pathname.endsWith('/faqs') || pathname === '/api/faqs' || pathname === '/faqs') {
    if (process.env.NODE_ENV !== 'production') {
      logInfo(`✅ Routing ${req.method} request to handleContent/FAQs handler`);
    }
    setContentQueryType(req, 'faqs');
    return await handleContent(req, res, handlerOptions);
  }
  if (pathname.includes('/support-tickets') || pathname.endsWith('/support-tickets')) {
    setContentQueryType(req, 'support-tickets');
    return await handleContent(req, res, handlerOptions);
  }
  // content-reports before content — segment match so /content does not swallow /content-reports
  if (pathHasSegment(pathname, '/content-reports')) {
    return await handleContentReports(req, res, handlerOptions);
  }
  if (pathHasSegment(pathname, '/content')) {
    return await handleContent(req, res, handlerOptions);
  }
  if (pathname.includes('/sell-car') || pathname.endsWith('/sell-car')) {
    const { handleSellCar } = await import('../handlers/sell-car.js');
    return await handleSellCar(req, res, handlerOptions);
  }
  if (
    pathname.includes('/payments') ||
    pathname.endsWith('/payments') ||
    pathname.includes('/plans') ||
    pathname.endsWith('/plans') ||
    pathname.includes('/business')
  ) {
    return await handleBusiness(req, res, handlerOptions);
  }
  if (pathname.includes('/conversations') || pathname.endsWith('/conversations')) {
    return await handleConversations(req, res, handlerOptions);
  }
  if (pathname.includes('/notifications') || pathname.endsWith('/notifications')) {
    return await handleNotifications(req, res, handlerOptions);
  }
  if (pathname.includes('/buyer-activity') || pathname.endsWith('/buyer-activity')) {
    const { handleBuyerActivity } = await import('../handlers/buyer-activity.js');
    return await handleBuyerActivity(req, res, handlerOptions);
  }
  if (pathname.includes('/chat') && !pathname.includes('/chat-websocket')) {
    const { handleSupportChat } = await import('../handlers/support-chat.js');
    return await handleSupportChat(req, res);
  }
  if (pathname.includes('/audit-log') || pathname.endsWith('/audit-log')) {
    return await handleAuditLog(req, res, handlerOptions);
  }
  if (pathname.includes('/settings') || pathname.endsWith('/settings')) {
    return await handlePlatformSettings(req, res, handlerOptions);
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({
    success: false,
    reason: 'API route not found',
    error: `No platform handler for ${pathname}`,
  });
}

export async function dispatchPlatformRewrite(
  req: VercelRequest,
  res: VercelResponse,
  checkPath: string,
  handlerOptions: HandlerOptions,
): Promise<void | VercelResponse> {
  if (checkPath.includes('/faqs') || checkPath.endsWith('/faqs')) {
    setContentQueryType(req, 'faqs');
    return await handleContent(req, res, handlerOptions);
  }
  if (checkPath.includes('/support-tickets') || checkPath.endsWith('/support-tickets')) {
    setContentQueryType(req, 'support-tickets');
    return await handleContent(req, res, handlerOptions);
  }
  if (pathHasSegment(checkPath, '/content-reports')) {
    return await handleContentReports(req, res, handlerOptions);
  }
  if (pathHasSegment(checkPath, '/content')) {
    return await handleContent(req, res, handlerOptions);
  }
  if (checkPath.includes('/audit-log') || checkPath.endsWith('/audit-log')) {
    return await handleAuditLog(req, res, handlerOptions);
  }
  if (checkPath.includes('/conversations') || checkPath.endsWith('/conversations')) {
    return await handleConversations(req, res, handlerOptions);
  }
  if (checkPath.includes('/buyer-activity') || checkPath.endsWith('/buyer-activity')) {
    const { handleBuyerActivity } = await import('../handlers/buyer-activity.js');
    return await handleBuyerActivity(req, res, handlerOptions);
  }
  if (checkPath.includes('/notifications') || checkPath.endsWith('/notifications')) {
    return await handleNotifications(req, res, handlerOptions);
  }
  if (checkPath.includes('/settings') || checkPath.endsWith('/settings')) {
    return await handlePlatformSettings(req, res, handlerOptions);
  }
  return undefined;
}

const PLATFORM_SEGMENTS = [
  '/ai',
  '/gemini',
  '/faqs',
  '/support-tickets',
  '/content-reports',
  '/content',
  '/sell-car',
  '/payments',
  '/plans',
  '/business',
  '/conversations',
  '/notifications',
  '/buyer-activity',
  '/chat',
  '/audit-log',
  '/settings',
] as const;

const MARKETPLACE_SEGMENTS = [
  '/users',
  '/vehicles',
  '/admin',
  '/seed',
  '/vehicle-specs',
  '/vehicle-pricing',
  '/geocode',
  '/vehicle-trust',
  '/deals',
  '/complaints',
  '/vehicle-data',
  '/system',
  '/utils',
  '/login',
  '/upload-image',
  '/services',
  '/provider-services',
  '/service-providers',
  '/service-requests',
  '/db-health',
  '/health',
] as const;

export function isPlatformPath(pathname: string): boolean {
  return PLATFORM_SEGMENTS.some((seg) => pathHasSegment(pathname, seg));
}

export function isMarketplacePath(pathname: string): boolean {
  return MARKETPLACE_SEGMENTS.some((seg) => pathHasSegment(pathname, seg));
}
