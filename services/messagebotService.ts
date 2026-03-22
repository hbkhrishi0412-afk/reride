/**
 * MessageBot SMS (India) — OTP via SendSmsV2
 * https://messagebot.in/docs
 */

export interface MessageBotConfig {
  apiToken: string;
  senderId: string;
  /** DLT entity ID (required for India transactional/OTP on most accounts) */
  dltEntityId?: string;
  dltTemplateId?: string;
  apiUrl?: string;
  /** Must match approved DLT template; `{otp}` is replaced */
  messageTemplate?: string;
}

export interface MessageBotSendResult {
  success: boolean;
  error?: string;
}

export function getMessageBotConfig(): MessageBotConfig | null {
  const apiToken = process.env.MESSAGEBOT_API_TOKEN?.trim();
  const senderId = process.env.MESSAGEBOT_SENDER_ID?.trim();
  if (!apiToken || !senderId) {
    return null;
  }

  const dltEntityId = process.env.MESSAGEBOT_DLT_ENTITY_ID?.trim();
  const dltTemplateId = process.env.MESSAGEBOT_DLT_TEMPLATE_ID?.trim();
  const apiUrl =
    process.env.MESSAGEBOT_API_URL?.trim() || 'https://papi.messagebot.in/SendSmsV2';
  const messageTemplate =
    process.env.MESSAGEBOT_OTP_MESSAGE_TEMPLATE?.trim() ||
    'Your ReRide OTP is {otp}. Valid for 10 minutes. Do not share with anyone.';

  return {
    apiToken,
    senderId,
    dltEntityId: dltEntityId || undefined,
    dltTemplateId: dltTemplateId || undefined,
    apiUrl,
    messageTemplate,
  };
}

/** MessageBot expects destination without +, e.g. 919876543210 */
export function toMessageBotDestination(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  return digits.startsWith('91') ? digits : `91${digits}`;
}

/**
 * Send OTP SMS via MessageBot SendSmsV2 (POST JSON).
 * messageType 3 = OTP per MessageBot docs.
 */
export async function sendMessageBotOTP(
  phoneE164: string,
  otp: string,
  config: MessageBotConfig,
): Promise<MessageBotSendResult> {
  try {
    const destinationAddress = toMessageBotDestination(phoneE164);
    const messageText = (config.messageTemplate || 'Your OTP is {otp}').replace(
      /\{otp\}/g,
      otp,
    );

    const body: Record<string, string> = {
      apiToken: config.apiToken,
      messageType: '3',
      messageEncoding: '1',
      destinationAddress,
      sourceAddress: config.senderId,
      messageText,
      userReferenceId: `reride-${Date.now()}`,
    };

    if (config.dltEntityId) {
      body.dltEntityId = config.dltEntityId;
    }
    if (config.dltTemplateId) {
      body.dltEntityTemplateId = config.dltTemplateId;
    }

    const response = await fetch(config.apiUrl || 'https://papi.messagebot.in/SendSmsV2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        error: `MessageBot: invalid JSON (${response.status}): ${raw.slice(0, 200)}`,
      };
    }

    const op = json.OperationCode;
    const status = json.Status;
    if (response.ok && op === 0 && status === 'Success') {
      return { success: true };
    }

    const remarks = typeof json.Remarks === 'string' ? json.Remarks : '';
    return {
      success: false,
      error: remarks || `MessageBot error (HTTP ${response.status})`,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to send OTP via MessageBot';
    return { success: false, error: msg };
  }
}
