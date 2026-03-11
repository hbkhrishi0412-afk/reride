/**
 * Email service using Resend.
 * Set RESEND_API_KEY and optional FROM_EMAIL in environment.
 */

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'ReRide <noreply@reride.co.in>';
const APP_NAME = 'ReRide';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'Email service not configured' };
    }
    console.warn('[Email] RESEND_API_KEY not set, skipping send:', options.subject);
    return { success: true };
  }

  try {
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

export async function sendVerificationEmail(email: string, verificationLink: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to: email,
    subject: `Verify your email - ${APP_NAME}`,
    html: `
      <p>Thanks for signing up. Please verify your email by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify email</a></p>
      <p>If you didn't create an account, you can ignore this email.</p>
      <p>— ${APP_NAME}</p>
    `,
    text: `Verify your email: ${verificationLink}`,
  });
}

export async function sendInquiryNotificationToSeller(sellerEmail: string, buyerName: string, vehicleTitle: string, messagePreview: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to: sellerEmail,
    subject: `New inquiry for "${vehicleTitle}" - ${APP_NAME}`,
    html: `
      <p>You have a new inquiry from ${buyerName} for your listing: ${vehicleTitle}.</p>
      <p>Message: ${messagePreview}</p>
      <p><a href="https://www.reride.co.in/inbox">View in Inbox</a></p>
      <p>— ${APP_NAME}</p>
    `,
    text: `New inquiry from ${buyerName} for ${vehicleTitle}. Message: ${messagePreview}. View: https://www.reride.co.in/inbox`,
  });
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to: email,
    subject: `Reset your password - ${APP_NAME}`,
    html: `
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetLink}">Reset password</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
      <p>— ${APP_NAME}</p>
    `,
    text: `Reset password: ${resetLink}`,
  });
}
