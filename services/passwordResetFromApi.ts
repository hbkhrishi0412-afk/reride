import { authenticatedFetch } from '../utils/authenticatedFetch';

/**
 * Request a password reset for `public.users` (bcrypt). Sends email via Resend when configured.
 * Always succeeds with the same user-facing copy if the account exists or not.
 */
export async function requestUsersTablePasswordReset(email: string): Promise<{
  success: boolean;
  reason?: string;
}> {
  const response = await authenticatedFetch('/api/users', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      action: 'request-password-reset',
      email: email.toLowerCase().trim(),
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    reason?: string;
    message?: string;
  };
  if (!response.ok) {
    return { success: false, reason: data.reason || 'Could not send reset email.' };
  }
  return { success: data.success !== false, reason: data.reason };
}

/**
 * Complete reset using JWT from the email link (`/forgot-password?token=...`).
 */
export async function completeUsersTablePasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; reason?: string }> {
  const response = await authenticatedFetch('/api/users', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      action: 'complete-password-reset',
      token: token.trim(),
      password: newPassword,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { success?: boolean; reason?: string };
  if (!response.ok) {
    return { success: false, reason: data.reason || 'Could not update password.' };
  }
  return { success: data.success === true, reason: data.reason };
}
