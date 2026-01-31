// Server-side Supabase authentication helpers
import { getSupabaseAdminClient } from '../lib/supabase.js';

/**
 * Verify Supabase JWT token from Authorization header
 * Returns the user ID and email if token is valid
 */
export async function verifySupabaseToken(
  authHeader: string | undefined
): Promise<{ uid: string; email: string; user: any }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  
  try {
    const supabase = getSupabaseAdminClient();
    
    // Verify the JWT token using Supabase admin client
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new Error('Invalid or expired token');
    }

    return {
      uid: user.id,
      email: user.email || '',
      user,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Token verification failed: ${errorMessage}`);
  }
}

/**
 * Verify Supabase token from request headers
 * Convenience wrapper for API routes
 */
export async function verifyIdTokenFromHeader(
  req: { headers: { authorization?: string } }
): Promise<{ uid: string; email: string; user: any }> {
  return verifySupabaseToken(req.headers.authorization);
}






