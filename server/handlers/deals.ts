/**
 * Deal pipeline API router: RR-LD-xxx leads, timeline, surveys, assistance.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { USE_SUPABASE, type HandlerOptions } from '../handler-shared.js';
import { handleDealComplaints } from './deals/deal-complaints.js';
import { handleLeadLifecycle } from './deals/lead-lifecycle.js';
import { handleStageHandlers } from './deals/stage-handlers.js';
import { handleAssistance } from './deals/assistance.js';
import { handleInspections } from './deals/inspections.js';
import { handleAdminOps } from './deals/admin-ops.js';
import { handleReturnLifecycle } from './deals/return-lifecycle.js';
import { firstQueryParam } from './deals/shared.js';

export async function handleDeals(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (!USE_SUPABASE) {
    return res.status(503).json({ success: false, reason: 'Database not available' });
  }

  const subPath = firstQueryParam(req.query?.action) || '';
  const method = req.method || 'GET';

  try {
    const ctx = { req, res, subPath, method };
    if (await handleDealComplaints(ctx)) return;
    if (await handleLeadLifecycle(ctx)) return;
    if (await handleStageHandlers(ctx)) return;
    if (await handleAssistance(ctx)) return;
    if (await handleInspections(ctx)) return;
    if (await handleReturnLifecycle(ctx)) return;
    if (await handleAdminOps(ctx)) return;

    return res.status(404).json({ success: false, reason: 'Unknown deals action' });
  } catch (error) {
    console.error('deals handler error:', error);
    return res.status(500).json({
      success: false,
      reason: error instanceof Error ? error.message : 'Internal error',
    });
  }
}
