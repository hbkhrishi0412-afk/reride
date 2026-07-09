import type { VercelRequest } from '@vercel/node';
import { verifyToken } from '../utils/security.js';
import { getSecurityConfig } from '../utils/security-config.js';
import { verifySupabaseToken } from '../server/supabase-auth.js';
import { resolveAuthRoleFromEmail } from '../utils/resolveAuthRole.js';

// Authentication middleware
export interface AuthResult {
  isValid: boolean;
  user?: { userId: string; email: string; role: string; type?: string }; // role includes service_provider from JWT
  error?: string;
}

export const authenticateRequest = (req: VercelRequest): AuthResult => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'No valid authorization header' };
  }

  const securityConfig = getSecurityConfig();
  const secret = securityConfig.JWT.SECRET;
  if (!secret) {
    return { 
      isValid: false, 
      error: 'Server configuration error: JWT secret is missing' 
    };
  }

  try {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);
    // Ensure role is present for the user object
    const user = {
      ...decoded,
      role: decoded.role || 'customer' as 'customer' | 'seller' | 'admin'
    };
    return { isValid: true, user };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid or expired token';
    return { isValid: false, error: message };
  }
};

/** App JWT (reRideAccessToken) or Supabase access_token in Authorization header. */
export const authenticateRequestDual = async (req: VercelRequest): Promise<AuthResult> => {
  const legacy = authenticateRequest(req);
  if (legacy.isValid) return legacy;

  try {
    const sb = await verifySupabaseToken(req.headers.authorization);
    const email = (sb.email || '').toLowerCase().trim();
    if (!email) {
      return { isValid: false, error: 'Invalid Supabase token' };
    }
    const meta = sb.user?.app_metadata as Record<string, unknown> | undefined;
    const appMetaRole = typeof meta?.role === 'string' ? meta.role : undefined;
    const role = await resolveAuthRoleFromEmail(email, appMetaRole);
    return {
      isValid: true,
      user: {
        userId: sb.uid,
        email,
        role,
      },
    };
  } catch {
    return { isValid: false, error: legacy.error || 'Authentication required' };
  }
};


















