/**
 * Server-side Web Push (PWA) via VAPID — works when the browser tab is closed.
 */
import webpush from 'web-push';
import { getSupabaseAdminClient } from './supabase-admin.js';

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  conversationId?: string;
  leadId?: string;
  action?: string;
  type?: string;
}

function getVapidPublicKey(): string | null {
  const key =
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    process.env.VITE_VAPID_PUBLIC_KEY?.trim() ||
    '';
  return key || null;
}

export function isWebPushConfigured(): boolean {
  return !!(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@reride.co.in';
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

type StoredSubscription = {
  endpoint: string;
  subscription: webpush.PushSubscription;
};

async function loadUserSubscriptions(userEmail: string): Promise<StoredSubscription[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('web_push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_email', userEmail.toLowerCase().trim());
  if (error || !data?.length) return [];
  return data
    .filter((row) => row?.endpoint && row?.subscription)
    .map((row) => ({
      endpoint: String(row.endpoint),
      subscription: row.subscription as webpush.PushSubscription,
    }));
}

async function removeSubscription(endpoint: string): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('web_push_subscriptions').delete().eq('endpoint', endpoint);
  } catch {
    /* non-fatal */
  }
}

/** Send web push to all browsers/devices registered for this user. */
export async function sendWebPushToUser(userEmail: string, payload: WebPushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const subs = await loadUserSubscriptions(userEmail);
  if (subs.length === 0) return;

  const swPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'reride-notification',
    data: {
      url: payload.url || '/#/inbox',
      conversationId: payload.conversationId,
      leadId: payload.leadId,
      action: payload.action,
      type: payload.type || (payload.leadId ? 'deal' : 'conversation'),
    },
  });

  await Promise.all(
    subs.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, swPayload, { TTL: 60 * 60 * 24 });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await removeSubscription(endpoint);
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Web push failed:', status, err instanceof Error ? err.message : err);
        }
      }
    }),
  );
}
