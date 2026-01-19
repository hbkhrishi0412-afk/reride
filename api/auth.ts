import type { VercelRequest } from '@vercel/node';
import { verifyToken } from '../utils/security.js';
import { getSecurityConfig } from '../utils/security-config.js';

// Authentication middleware
export interface AuthResult {
  isValid: boolean;
  user?: { userId: string; email: string; role: string; type?: string };
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


















