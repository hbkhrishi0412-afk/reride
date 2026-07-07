import { supabaseUserService } from '../services/supabase-user-service.js';
import { normalizeUserRoleString } from './user-role.js';

export type ApiAuthRole = 'customer' | 'seller' | 'admin';

/**
 * Authoritative role for API authorization — always prefers the database over
 * Supabase JWT metadata (user_metadata is client-writable).
 */
export async function resolveAuthRoleFromEmail(
  email: string,
  /** Optional hint from server-set app_metadata only — never user_metadata. */
  appMetadataRole?: unknown,
): Promise<ApiAuthRole> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) return 'customer';

  try {
    const dbUser = await supabaseUserService.findByEmail(normalizedEmail);
    if (dbUser?.role) {
      const role = normalizeUserRoleString(dbUser.role);
      if (role === 'admin') return 'admin';
      if (role === 'seller') return 'seller';
      return 'customer';
    }
  } catch {
    /* non-fatal — fall through to app_metadata hint */
  }

  const hinted = normalizeUserRoleString(appMetadataRole);
  if (hinted === 'admin') return 'admin';
  if (hinted === 'seller') return 'seller';
  return 'customer';
}
