import type { User } from '../types';
import { getAuthHeaders } from '../utils/authenticatedFetch';

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

export async function requestAccountDataAnonymization(): Promise<{ success: boolean; message?: string; reason?: string }> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ action: 'request-data-deletion' }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    reason?: string;
  };
  return {
    success: Boolean(data.success),
    message: data.message,
    reason: data.reason,
  };
}
