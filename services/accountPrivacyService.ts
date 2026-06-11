import type { User } from '../types.js';
import { authenticatedFetch } from '../utils/authenticatedFetch.js';

export function downloadProfileExport(currentUser: User): void {
  const bundle = {
    exportedAt: new Date().toISOString(),
    profile: { ...currentUser, password: undefined },
    note: 'This export contains your profile as stored in the app. Listings and messages may exist separately on the server.',
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safe = (currentUser.email || 'user').replace(/[^a-z0-9]+/gi, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `reride-my-data-${safe}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Permanently delete the signed-in user's account (required by Apple/Google app store rules). */
export async function requestAccountDeletion(
  email: string,
): Promise<{ success: boolean; message?: string; reason?: string }> {
  const res = await authenticatedFetch('/api/users', {
    method: 'DELETE',
    body: JSON.stringify({ email }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    reason?: string;
  };
  return {
    success: res.ok && Boolean(data.success),
    message: data.message || (res.ok ? 'Your account has been permanently deleted.' : undefined),
    reason: data.reason,
  };
}

/** @deprecated Use requestAccountDeletion — anonymization alone does not meet app store requirements. */
export async function requestAccountDataAnonymization(): Promise<{ success: boolean; message?: string; reason?: string }> {
  return { success: false, reason: 'Use requestAccountDeletion for full account removal.' };
}
