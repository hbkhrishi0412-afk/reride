/**
 * Email + web push alerts to admins when deal assistance is requested.
 */
import { sendEmail } from './email.js';
import { sendWebPushToUser } from './webPushSender.js';

const APP_BASE = (
  process.env.APP_URL ||
  process.env.VITE_APP_URL ||
  'https://www.reride.co.in'
).replace(/\/$/, '');

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export interface DealAssistanceAdminAlertParams {
  adminEmails: string[];
  leadId: string;
  packageLabel: string;
  source: 'purchase' | 'survey';
  amount?: number;
}

/** Fire-and-forget email to ops admins (never throws). */
export function notifyAdminsDealAssistanceEmail(params: DealAssistanceAdminAlertParams): void {
  const emails = params.adminEmails.map(normalizeEmail).filter((e) => e.includes('@'));
  if (!emails.length) return;

  const queueUrl = `${APP_BASE}/admin?tab=assistanceQueue&leadId=${encodeURIComponent(params.leadId)}`;
  const amountLine = params.amount
    ? `<p>Amount paid: <strong>₹${params.amount.toLocaleString('en-IN')}</strong></p>`
    : '';

  void sendEmail({
    to: emails.slice(0, 10),
    subject: `Deal assistance: ${params.packageLabel} — ${params.leadId}`,
    html: `
      <p>A new deal assistance request needs ops attention.</p>
      <p><strong>Deal:</strong> ${params.leadId}</p>
      <p><strong>Package:</strong> ${params.packageLabel}</p>
      <p><strong>Source:</strong> ${params.source}</p>
      ${amountLine}
      <p><a href="${queueUrl}">Open Assistance Queue</a></p>
      <p>— ReRide Ops</p>
    `,
    text: `Deal assistance: ${params.packageLabel} for ${params.leadId}. Open: ${queueUrl}`,
  }).catch((err) => {
    console.warn('deal assistance admin email failed (non-fatal):', err);
  });
}

/** Fire-and-forget web push per admin (never throws). */
export function notifyAdminDealAssistancePush(params: {
  adminEmail: string;
  leadId: string;
  packageLabel: string;
}): void {
  const email = normalizeEmail(params.adminEmail);
  if (!email.includes('@')) return;

  void sendWebPushToUser(email, {
    title: 'Deal assistance request',
    body: `${params.packageLabel} for ${params.leadId}`,
    url: `/#/admin?tab=assistanceQueue&leadId=${encodeURIComponent(params.leadId)}`,
    tag: `deal-assist-${params.leadId}`,
    leadId: params.leadId,
    action: 'view_assistance',
    type: 'deal',
  }).catch((err) => {
    console.warn('deal assistance admin push failed (non-fatal):', err);
  });
}
