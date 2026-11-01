/**
 * Login OTP via Meta WhatsApp Cloud API (authentication template).
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/auth-otp-template-messages
 */

export interface WhatsAppOtpConfig {
  token: string;
  phoneNumberId: string;
  templateName: string;
  templateLang: string;
  /** Meta auth templates include a copy-code button that must receive the same OTP. */
  copyCodeButton: boolean;
  graphVersion: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  error?: string;
}

export function getWhatsAppOtpConfig(): WhatsAppOtpConfig | null {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;

  const copy = process.env.WHATSAPP_OTP_COPY_CODE?.trim().toLowerCase();
  return {
    token,
    phoneNumberId,
    templateName: process.env.WHATSAPP_OTP_TEMPLATE?.trim() || 'reride_login_otp',
    templateLang: process.env.WHATSAPP_OTP_TEMPLATE_LANG?.trim() || 'en',
    copyCodeButton: copy !== 'false' && copy !== '0',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0',
  };
}

export function toWhatsAppRecipient(e164: string): string {
  return e164.replace(/\D/g, '');
}

export function buildWhatsAppOtpBody(
  toDigits: string,
  otp: string,
  config: Pick<WhatsAppOtpConfig, 'templateName' | 'templateLang' | 'copyCodeButton'>,
): Record<string, unknown> {
  const components: Array<Record<string, unknown>> = [
    { type: 'body', parameters: [{ type: 'text', text: otp }] },
  ];
  if (config.copyCodeButton) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: otp }],
    });
  }
  return {
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'template',
    template: {
      name: config.templateName,
      language: { code: config.templateLang },
      components,
    },
  };
}

export async function sendWhatsAppOTP(
  phoneE164: string,
  otp: string,
  config: WhatsAppOtpConfig,
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildWhatsAppOtpBody(toWhatsAppRecipient(phoneE164), otp, config),
      ),
      signal: controller.signal,
    });
    const raw = await response.text();
    let json: Record<string, unknown> = {};
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return { success: false, error: 'WhatsApp delivery failed' };
    }
    if (response.ok && Array.isArray(json.messages) && json.messages.length > 0) {
      return { success: true };
    }
    return { success: false, error: 'WhatsApp delivery failed' };
  } catch {
    return { success: false, error: 'WhatsApp delivery failed' };
  } finally {
    clearTimeout(timer);
  }
}
