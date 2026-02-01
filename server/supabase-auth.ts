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
    // CRITICAL: Check if SUPABASE_SERVICE_ROLE_KEY is configured before attempting to get admin client
    // This provides a clearer error message if the key is missing
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || 
        process.env.SUPABASE_SERVICE_ROLE_KEY.trim() === '' ||
        process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_supabase_service_role_key')) {
      console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not configured!');
      console.error('   This is required for token verification. Set it in Vercel environment variables.');
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
        'Please set SUPABASE_SERVICE_ROLE_KEY in your production environment variables (Vercel). ' +
        'This key is required for server-side authentication operations.'
      );
    }

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
    
    // Preserve the original error message if it's already descriptive
    if (errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      throw error; // Re-throw the original error with full context
    }
    
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








