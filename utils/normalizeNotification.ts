import type { Notification } from '../types.js';

/** Map a Supabase/API notification row to the client Notification shape. */
export function normalizeNotificationRow(row: Record<string, unknown>): Notification {
  const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
    string,
    unknown
  >;
  const rawType = String(row.type || meta.targetType || 'general');
  const ts = String(row.created_at || row.timestamp || new Date().toISOString());

  let targetType: Notification['targetType'] = 'general_admin';
  if (rawType === 'conversation' || meta.targetType === 'conversation') {
    targetType = 'conversation';
  } else if (rawType === 'vehicle' || meta.targetType === 'vehicle') {
    targetType = 'vehicle';
  } else if (rawType === 'price_drop' || meta.targetType === 'price_drop') {
    targetType = 'price_drop';
  } else if (rawType === 'deal' || meta.targetType === 'deal') {
    targetType = 'deal';
  } else if (rawType === 'service_request' || meta.targetType === 'service_request') {
    targetType = 'service_request';
  } else if (rawType === 'insurance_expiry' || meta.targetType === 'insurance_expiry') {
    targetType = 'insurance_expiry';
  }

  const targetId =
    meta.targetId ??
    meta.conversationId ??
    meta.leadId ??
    row.id ??
    '';

  const vehicleIdRaw = meta.vehicleId ?? (targetType === 'vehicle' ? targetId : undefined);
  const vehicleId =
    vehicleIdRaw != null && !Number.isNaN(Number(vehicleIdRaw)) ? Number(vehicleIdRaw) : undefined;

  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id) || Date.now(),
    recipientEmail: String(row.recipient_email || row.recipientEmail || row.user_id || ''),
    message: String(row.message || ''),
    title: row.title ? String(row.title) : undefined,
    targetId,
    vehicleId,
    targetType,
    type: rawType,
    isRead: Boolean(row.read ?? row.is_read ?? row.isRead ?? false),
    timestamp: ts,
    dealLeadId: meta.leadId ? String(meta.leadId) : undefined,
    dealAction:
      meta.action === 'accept_chat'
        ? 'accept_chat'
        : meta.action === 'open_deal'
          ? 'open_deal'
          : meta.action === 'view_complaint'
            ? 'view_complaint'
            : meta.action === 'view_assistance'
              ? 'view_assistance'
              : undefined,
    conversationId: meta.conversationId ? String(meta.conversationId) : undefined,
  };
}
