/**
 * SMS + push when a buyer expresses interest (deal lead created).
 */
import { getSupabaseAdminClient } from './supabase-admin.js';
import { sendWebPushToUser } from './webPushSender.js';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface SellerDealLeadAlertParams {
  sellerEmail: string;
  buyerName: string;
  vehicleTitle: string;
  leadId: string;
  conversationId?: string;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

let firebaseAdminApp: App | null | undefined;

function getFirebaseAdminApp(): App | null {
  if (firebaseAdminApp !== undefined) return firebaseAdminApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) {
    firebaseAdminApp = null;
    return null;
  }
  try {
    const serviceAccount = JSON.parse(raw) as Record<string, string>;
    if (getApps().length === 0) {
      firebaseAdminApp = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
    } else {
      firebaseAdminApp = getApps()[0]!;
    }
    return firebaseAdminApp;
  } catch {
    firebaseAdminApp = null;
    return null;
  }
}

async function sendNativeDealPush(params: SellerDealLeadAlertParams, title: string, body: string): Promise<void> {
  const app = getFirebaseAdminApp();
  if (!app) return;

  let token: string | null = null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from('push_device_tokens')
      .select('token')
      .eq('user_email', normalizeEmail(params.sellerEmail))
      .maybeSingle();
    if (!data?.token) return;
    token = String(data.token);
  } catch {
    return;
  }

  try {
    const messaging = getMessaging(app);
    await messaging.send({
      token,
      notification: { title, body },
      data: {
        type: 'deal',
        leadId: params.leadId,
        action: 'accept_chat',
        conversationId: params.conversationId || '',
        url: 'https://www.reride.co.in/inbox',
      },
      android: {
        priority: 'high',
        notification: { channelId: 'seller_inquiries', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  } catch (err) {
    console.warn('⚠️ Deal lead FCM push failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

async function sendWebDealPush(params: SellerDealLeadAlertParams, title: string, body: string): Promise<void> {
  try {
    await sendWebPushToUser(normalizeEmail(params.sellerEmail), {
      title,
      body,
      url: '/#/inbox',
      tag: `deal-lead-${params.leadId}`,
      leadId: params.leadId,
      action: 'accept_chat',
      conversationId: params.conversationId,
      type: 'deal',
    });
  } catch (err) {
    console.warn('⚠️ Deal lead web push failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

/** Fire-and-forget push for new deal leads (never throws). */
export function notifySellerDealLeadChannels(params: SellerDealLeadAlertParams): void {
  const buyer = params.buyerName || 'A buyer';
  const vehicle = params.vehicleTitle || 'your listing';
  const title = 'New Lead — Buyer Interested';
  const body = `${buyer} is interested in ${vehicle}. Tap to accept chat.`;
  void sendNativeDealPush(params, title, body);
  void sendWebDealPush(params, title, body);
}
