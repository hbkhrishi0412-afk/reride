import { logInfo } from '../utils/logger.js';
/**
 * SMS + push alerts (native FCM + PWA web push) when a buyer messages or books a test drive.
 * Email is handled separately in lib/email.ts.
 */
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getSupabaseAdminClient } from './supabase-admin.js';
import { sendWebPushToUser } from './webPushSender.js';
import { getKarixConfig, sendKarixTransactionalSMS } from '../services/karixService.js';
import {
  getMessageBotConfig,
  sendMessageBotTransactionalSMS,
} from '../services/messagebotService.js';
import { supabaseUserService } from '../services/supabase-user-service.js';

export interface SellerInquiryAlertParams {
  sellerEmail: string;
  buyerName: string;
  vehicleTitle: string;
  messagePreview: string;
  conversationId: string;
  isTestDrive?: boolean;
  testDriveDate?: string;
  testDriveTime?: string;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildAlertCopy(params: SellerInquiryAlertParams): { title: string; body: string; smsText: string } {
  const buyer = params.buyerName || 'A buyer';
  const vehicle = params.vehicleTitle || 'your listing';
  const preview = truncate(params.messagePreview || 'New message', 120);

  if (params.isTestDrive) {
    const when = [params.testDriveDate, params.testDriveTime].filter(Boolean).join(' at ');
    const title = 'Test drive request';
    const body = when
      ? `${buyer} requested a test drive for ${vehicle} on ${when}.`
      : `${buyer} requested a test drive for ${vehicle}.`;
    const smsText = when
      ? `ReRide: Test drive from ${buyer} for ${vehicle} on ${when}. Open inbox to confirm.`
      : `ReRide: Test drive from ${buyer} for ${vehicle}. Open inbox to confirm.`;
    return { title, body, smsText: truncate(smsText, 160) };
  }

  const title = 'New buyer inquiry';
  const body = `${buyer} messaged you about ${vehicle}: ${preview}`;
  const smsText = truncate(
    `ReRide: New message from ${buyer} for ${vehicle}. ${preview} Reply at reride.co.in/inbox`,
    160,
  );
  return { title, body, smsText };
}

function toE164Indian(mobile: string): string | null {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length >= 11 && mobile.trim().startsWith('+')) return mobile.trim();
  return null;
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

async function sendNativePushAlert(
  sellerEmail: string,
  title: string,
  body: string,
  conversationId: string,
): Promise<void> {
  const app = getFirebaseAdminApp();
  if (!app) return;

  let token: string | null = null;
  let platform: string | null = null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('push_device_tokens')
      .select('token, platform')
      .eq('user_email', normalizeEmail(sellerEmail))
      .maybeSingle();
    if (error || !data?.token) return;
    token = String(data.token);
    platform = data.platform ? String(data.platform) : null;
  } catch {
    return;
  }

  try {
    const messaging = getMessaging(app);
    await messaging.send({
      token,
      notification: { title, body },
      data: {
        type: 'conversation',
        conversationId: String(conversationId),
        url: `https://www.reride.co.in/inbox`,
      },
      android: {
        priority: 'high',
        notification: { channelId: 'seller_inquiries', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    if (process.env.NODE_ENV === 'development') {
      logInfo(`📲 FCM push sent to seller (${platform || 'unknown'}):`, sellerEmail);
    }
  } catch (err) {
    console.warn('⚠️ FCM push to seller failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

async function sendPwaWebPushAlert(
  sellerEmail: string,
  title: string,
  body: string,
  conversationId: string,
): Promise<void> {
  try {
    await sendWebPushToUser(normalizeEmail(sellerEmail), {
      title,
      body,
      url: '/#/inbox',
      tag: `seller-inquiry-${conversationId}`,
      conversationId,
    });
    if (process.env.NODE_ENV === 'development') {
      logInfo('🌐 Web push sent to seller:', sellerEmail);
    }
  } catch (err) {
    console.warn('⚠️ Web push to seller failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

async function sendSmsAlert(sellerEmail: string, smsText: string): Promise<void> {
  if (process.env.SELLER_ALERT_SMS_ENABLED === 'false') return;

  let mobile: string | undefined;
  try {
    const seller = await supabaseUserService.findByEmail(normalizeEmail(sellerEmail));
    mobile = seller?.mobile?.trim();
  } catch {
    return;
  }
  if (!mobile) return;

  const phoneE164 = toE164Indian(mobile);
  if (!phoneE164) return;

  const mbConfig = getMessageBotConfig();
  if (mbConfig) {
    const result = await sendMessageBotTransactionalSMS(phoneE164, smsText, mbConfig);
    if (result.success) {
      if (process.env.NODE_ENV === 'development') {
        logInfo('📱 Seller alert SMS sent via MessageBot:', sellerEmail);
      }
      return;
    }
    console.warn('⚠️ MessageBot seller alert failed:', result.error);
  }

  const karixConfig = getKarixConfig();
  if (karixConfig) {
    const result = await sendKarixTransactionalSMS(phoneE164, smsText, karixConfig);
    if (result.success) {
      if (process.env.NODE_ENV === 'development') {
        logInfo('📱 Seller alert SMS sent via Karix:', sellerEmail);
      }
      return;
    }
    console.warn('⚠️ Karix seller alert failed:', result.error);
  }
}

/** Fire-and-forget SMS + push (FCM + PWA) for seller inquiries (never throws). */
export function notifySellerInquiryChannels(params: SellerInquiryAlertParams): void {
  const { title, body, smsText } = buildAlertCopy(params);
  void sendSmsAlert(params.sellerEmail, smsText).catch((err) => {
    console.warn('⚠️ Seller SMS alert error (non-fatal):', err);
  });
  void sendNativePushAlert(params.sellerEmail, title, body, params.conversationId).catch((err) => {
    console.warn('⚠️ Seller native push alert error (non-fatal):', err);
  });
  void sendPwaWebPushAlert(params.sellerEmail, title, body, params.conversationId);
}
