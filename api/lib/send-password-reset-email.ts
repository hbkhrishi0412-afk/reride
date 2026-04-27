/**
 * Optional Resend delivery for "forgot password" (public.users).
 * Set RESEND_API_KEY in production; in development without a key we log the link to server logs.
 */

export function getPublicAppOriginForPasswordReset(): string {
  const explicit =
    process.env.VITE_APP_URL?.trim() ||
    process.env.APP_ORIGIN?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    '';
  if (explicit && /^https?:\/\//i.test(explicit)) {
    return explicit.replace(/\/+$/, '');
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }
  return 'http://localhost:5173';
}

/**
 * @returns `sent` if user-facing delivery succeeded. `devLogged` true if link was only printed (dev / no key).
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<{ sent: true; devLogged: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'ReRide <onboarding@resend.dev>';
  const subject = process.env.RESEND_RESET_SUBJECT?.trim() || 'Reset your ReRide password';

  if (apiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject,
        html: `<p>Hi,</p>
<p>We received a request to reset the password for your ReRide account.</p>
<p><a href="${resetUrl.replace(/"/g, '%22')}">Set a new password</a></p>
<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
<p>— ReRide</p>`,
        text: `Reset your ReRide password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend error ${res.status}: ${text || res.statusText}`);
    }
    return { sent: true, devLogged: false };
  }

  const isDev = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'development';
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[ReRide] password reset link (set RESEND_API_KEY to email):`, resetUrl);
    return { sent: true, devLogged: true };
  }

  throw new Error(
    'Password reset email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL (verified domain) in the server environment.',
  );
}
