/**
 * Supabase Auth — Send SMS Hook (HTTP).
 * @see https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
 */
import { Webhook } from 'standardwebhooks';
import { sendKarixOTP, getKarixConfig } from '../services/karixService.js';
import { sendMessageBotOTP, getMessageBotConfig } from '../services/messagebotService.js';
import { logError, logInfo } from '../utils/logger.js';

export type SendSmsHookResult =
  | { ok: true }
  | { ok: false; http_code: number; message: string };

/** Normalize dashboard secret forms to the base64 segment expected by standardwebhooks. */
function normalizeHookSecret(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('v1,whsec_')) {
    return s.slice('v1,whsec_'.length);
  }
  if (s.startsWith('whsec_')) {
    return s.slice('whsec_'.length);
  }
  return s;
}

interface SmsHookPayload {
  user?: { phone?: string };
  sms?: { otp?: string };
}

function strHeader(v: string | string[] | undefined): string {
  if (v === undefined) return '';
  return Array.isArray(v) ? v[0] : v;
}

/** Standard Webhooks headers only (literal property access). */
function standardWebhookHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> {
  return {
    'webhook-id': strHeader(headers['webhook-id']),
    'webhook-timestamp': strHeader(headers['webhook-timestamp']),
    'webhook-signature': strHeader(headers['webhook-signature']),
  };
}

export function verifySendSmsPayload(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): SmsHookPayload {
  const secret = process.env.SEND_SMS_HOOK_SECRET?.trim();
  if (!secret) {
    throw new Error('SEND_SMS_HOOK_SECRET is not configured');
  }
  const wh = new Webhook(normalizeHookSecret(secret));
  return wh.verify(rawBody, standardWebhookHeaders(headers)) as SmsHookPayload;
}

function pickProvider(): 'messagebot' | 'karix' {
  const explicit = process.env.SMS_HOOK_PROVIDER?.trim().toLowerCase();
  if (explicit === 'messagebot' || explicit === 'karix') {
    return explicit;
  }
  if (getMessageBotConfig()) {
    return 'messagebot';
  }
  return 'karix';
}

export async function sendAuthSms(phone: string, otp: string): Promise<SendSmsHookResult> {
  const provider = pickProvider();
  if (provider === 'messagebot') {
    const cfg = getMessageBotConfig();
    if (!cfg) {
      return {
        ok: false,
        http_code: 503,
        message: 'MessageBot is not configured. Set MESSAGEBOT_API_TOKEN and MESSAGEBOT_SENDER_ID.',
      };
    }
    const r = await sendMessageBotOTP(phone, otp, cfg);
    if (!r.success) {
      return { ok: false, http_code: 502, message: r.error || 'Failed to send SMS via MessageBot' };
    }
    return { ok: true };
  }

  const kcfg = getKarixConfig();
  if (!kcfg) {
    return {
      ok: false,
      http_code: 503,
      message: 'Karix is not configured. Set KARIX_API_KEY and KARIX_API_SECRET (or use MessageBot + SMS_HOOK_PROVIDER=messagebot).',
    };
  }
  const r = await sendKarixOTP(phone, otp, kcfg);
  if (!r.success) {
    return { ok: false, http_code: 502, message: r.error || 'Failed to send SMS via Karix' };
  }
  return { ok: true };
}

export async function handleSendSmsHookRequest(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): Promise<SendSmsHookResult> {
  let payload: SmsHookPayload;
  try {
    payload = verifySendSmsPayload(rawBody, headers);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('Send SMS hook: verification failed:', msg);
    return { ok: false, http_code: 401, message: `Invalid webhook: ${msg}` };
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp) {
    return { ok: false, http_code: 400, message: 'Missing user.phone or sms.otp' };
  }

  const provider = pickProvider();
  logInfo('📱 Send SMS hook: sending OTP via', provider);
  return sendAuthSms(phone, otp);
}

export interface SendSmsHookResponse {
  status: (code: number) => SendSmsHookResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
}

/** Express / Vercel-compatible response writer */
export async function respondToSendSmsHook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  res: SendSmsHookResponse
): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  const result = await handleSendSmsHookRequest(rawBody, headers);
  if (result.ok) {
    res.status(200).json({});
    return;
  }
  const code =
    result.http_code >= 400 && result.http_code < 600 ? result.http_code : 500;
  res.status(code).json({
    error: {
      http_code: result.http_code,
      message: result.message,
    },
  });
}
