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
  if (pathname.includes('/content') || pathname.endsWith('/content')) {
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
  if (pathname.includes('/content-reports') || pathname.endsWith('/content-reports')) {
    return await handleContentReports(req, res, handlerOptions);
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
  if (checkPath.includes('/content') || checkPath.endsWith('/content')) {
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
  if (checkPath.includes('/content-reports') || checkPath.endsWith('/content-reports')) {
    return await handleContentReports(req, res, handlerOptions);
  }
  if (checkPath.includes('/notifications') || checkPath.endsWith('/notifications')) {
    return await handleNotifications(req, res, handlerOptions);
  }
  if (checkPath.includes('/settings') || checkPath.endsWith('/settings')) {
    return await handlePlatformSettings(req, res, handlerOptions);
  }
  return undefined;
}

export function isPlatformPath(pathname: string): boolean {
  return (
    pathname.includes('/ai') ||
    pathname.includes('/gemini') ||
    pathname.includes('/faqs') ||
    pathname.includes('/support-tickets') ||
    pathname.includes('/content') ||
    pathname.includes('/sell-car') ||
    pathname.includes('/payments') ||
    pathname.includes('/plans') ||
    pathname.includes('/business') ||
    pathname.includes('/conversations') ||
    pathname.includes('/notifications') ||
    pathname.includes('/buyer-activity') ||
    pathname.includes('/content-reports') ||
    pathname.includes('/chat') ||
    pathname.includes('/audit-log') ||
    pathname.includes('/settings')
  );
}

export function isMarketplacePath(pathname: string): boolean {
  return (
    pathname.includes('/users') ||
    pathname.includes('/vehicles') ||
    pathname.includes('/admin') ||
    pathname.includes('/seed') ||
    pathname.includes('/vehicle-specs') ||
    pathname.includes('/vehicle-pricing') ||
    pathname.includes('/geocode') ||
    pathname.includes('/vehicle-trust') ||
    pathname.includes('/deals') ||
    pathname.includes('/complaints') ||
    pathname.includes('/vehicle-data') ||
    pathname.includes('/system') ||
    pathname.includes('/utils') ||
    pathname.includes('/login') ||
    pathname.includes('/upload-image') ||
    (pathname.includes('/services') && !pathname.includes('/service-')) ||
    pathname.includes('/provider-services') ||
    pathname.includes('/service-providers') ||
    pathname.includes('/service-requests') ||
    pathname.includes('/health') ||
    pathname.includes('/db-health')
  );
}
