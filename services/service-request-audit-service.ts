import { getSupabaseAdminClient } from '../lib/supabase.js';

export type ServiceRequestAuditAction =
  | 'request_created'
  | 'request_claimed'
  | 'status_changed'
  | 'request_cancelled'
  | 'request_deleted'
  | 'review_submitted';

type AuditPayload = {
  requestId: string;
  actorId: string;
  actorRole: string;
  action: ServiceRequestAuditAction;
  previousStatus?: string | null;
  nextStatus?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Best-effort server audit logger for service request lifecycle actions.
 * It intentionally does not fail the request API when logging fails.
 */
export const serviceRequestAuditService = {
  async log(payload: AuditPayload): Promise<void> {
    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from('service_request_audit_logs').insert({
        request_id: payload.requestId,
        actor_id: payload.actorId,
        actor_role: payload.actorRole,
        action: payload.action,
        previous_status: payload.previousStatus || null,
        next_status: payload.nextStatus || null,
        details: payload.details || {},
      });
      if (error) {
        console.warn('Failed to write service request audit log:', error.message);
      }
    } catch (error) {
      console.warn('Service request audit logging failed:', error);
    }
  },
};

