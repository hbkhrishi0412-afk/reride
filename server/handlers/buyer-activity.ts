/**
 * server/handlers/buyer-activity.ts — Buyer activity sync (recently viewed, saved searches, alerts)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE,
  HandlerOptions,
  authenticateRequestDual,
  getSupabaseAdminClient,
  type AuthResult,
} from '../handler-shared.js';
import { logWarn, logError } from '../../utils/logger.js';

function firstQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function normalizeAuthActorEmail(auth: AuthResult | null | undefined): string {
  const email = auth?.user?.email ? String(auth.user.email).toLowerCase().trim() : '';
  if (email) return email;
  const userId = auth?.user?.userId ? String(auth.user.userId).toLowerCase().trim() : '';
  return userId.includes('@') ? userId : '';
}

/** Supports /api/buyer-activity?userId=email and legacy /api/buyer-activity/email paths. */
function resolveUserIdFromRequest(req: VercelRequest): string {
  const fromQuery = firstQueryParam(req.query?.userId as string | string[] | undefined);
  if (fromQuery) return fromQuery;

  const url = typeof req.url === 'string' ? req.url : '';
  const pathMatch = url.match(/\/buyer-activity\/([^/?]+)/i);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }
  return '';
}

export async function handleBuyerActivity(
  req: VercelRequest,
  res: VercelResponse,
  _options: HandlerOptions,
): Promise<void> {
  try {
    if (!USE_SUPABASE) {
      res.status(503).json({
        success: false,
        reason: 'Supabase is not configured. Please set Supabase environment variables.',
      });
      return;
    }

    const auth = await authenticateRequestDual(req);
    if (!auth.isValid || !auth.user) {
      logWarn('⚠️ Buyer Activity - Authentication failed:', auth.error);
      res.status(401).json({
        success: false,
        reason: auth.error || 'Authentication required.',
        error: 'Invalid or expired authentication token',
      });
      return;
    }

    const normalizedAuthEmail = normalizeAuthActorEmail(auth);
    const normalizedAuthUserId = auth.user.userId
      ? String(auth.user.userId).toLowerCase().trim()
      : '';
    const isAdmin = auth.user.role === 'admin';
    const canAccessBuyerActivity = (userId: string): boolean => {
      const norm = String(userId || '').toLowerCase().trim();
      if (!norm) return false;
      if (isAdmin) return true;
      if (norm === normalizedAuthEmail) return true;
      if (normalizedAuthUserId && norm === normalizedAuthUserId) return true;
      return false;
    };

    if (req.method === 'GET') {
      const userIdRaw = resolveUserIdFromRequest(req);
      if (!userIdRaw) {
        res.status(400).json({ success: false, reason: 'User ID is required' });
        return;
      }

      const normalizedUserId = userIdRaw.toLowerCase().trim();
      if (!canAccessBuyerActivity(normalizedUserId)) {
        res.status(403).json({ success: false, reason: 'Unauthorized access to buyer activity' });
        return;
      }

      const supabase = getSupabaseAdminClient();
      const { data: activity, error } = await supabase
        .from('buyer_activity')
        .select('*')
        .eq('user_id', normalizedUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(200).json({
            success: true,
            data: {
              id: `activity_${normalizedUserId}`,
              userId: normalizedUserId,
              recentlyViewed: [],
              savedSearches: [],
              notifications: { priceDrops: [], newMatches: [] },
            },
          });
          return;
        }
        logError('❌ Failed to fetch buyer activity:', error);
        res.status(500).json({ success: false, reason: 'Failed to fetch buyer activity' });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: activity.id,
          userId: activity.user_id,
          recentlyViewed: activity.recently_viewed || [],
          savedSearches: activity.saved_searches || [],
          notifications: {
            priceDrops: activity.price_drops || [],
            newMatches: activity.new_matches || [],
          },
        },
      });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const activityData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (!activityData.userId) {
        res.status(400).json({ success: false, reason: 'User ID is required' });
        return;
      }

      const normalizedUserId = String(activityData.userId).toLowerCase().trim();
      if (!canAccessBuyerActivity(normalizedUserId)) {
        res.status(403).json({ success: false, reason: 'Unauthorized to save buyer activity' });
        return;
      }

      const supabase = getSupabaseAdminClient();
      const { data: existing } = await supabase
        .from('buyer_activity')
        .select('id')
        .eq('user_id', normalizedUserId)
        .single();

      const activityRecord: Record<string, unknown> = {
        id: existing?.id || `activity_${normalizedUserId}_${Date.now()}`,
        user_id: normalizedUserId,
        recently_viewed: activityData.recentlyViewed || [],
        saved_searches: activityData.savedSearches || [],
        price_drops: activityData.notifications?.priceDrops || [],
        new_matches: activityData.notifications?.newMatches || [],
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('buyer_activity')
          .update(activityRecord)
          .eq('user_id', normalizedUserId)
          .select()
          .single();
        if (error) {
          logError('❌ Failed to update buyer activity:', error);
          res.status(500).json({ success: false, reason: 'Failed to update buyer activity' });
          return;
        }
        result = data;
      } else {
        activityRecord.created_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('buyer_activity')
          .insert(activityRecord)
          .select()
          .single();
        if (error) {
          logError('❌ Failed to create buyer activity:', error);
          res.status(500).json({ success: false, reason: 'Failed to create buyer activity' });
          return;
        }
        result = data;
      }

      res.status(200).json({
        success: true,
        data: {
          id: result.id,
          userId: result.user_id,
          recentlyViewed: result.recently_viewed || [],
          savedSearches: result.saved_searches || [],
          notifications: {
            priceDrops: result.price_drops || [],
            newMatches: result.new_matches || [],
          },
        },
      });
      return;
    }

    res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    logError('❌ Buyer Activity API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, reason: errorMessage, error: errorMessage });
  }
}
