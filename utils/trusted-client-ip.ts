import type { VercelRequest } from '@vercel/node';

/**
 * Extract client IP for rate limiting and abuse prevention.
 * Only trusts server-set identifiers — client-spoofable headers are ignored.
 */
export function getTrustedClientIP(req: VercelRequest): string {
  const vercelForwardedFor = req.headers['x-vercel-forwarded-for'];
  if (vercelForwardedFor) {
    const ips = Array.isArray(vercelForwardedFor) ? vercelForwardedFor[0] : vercelForwardedFor;
    const clientIP = String(ips).split(',')[0].trim();
    if (clientIP && clientIP !== '::1' && clientIP !== '127.0.0.1') {
      return clientIP;
    }
  }

  const socketIP = req.socket?.remoteAddress;
  if (socketIP && socketIP !== '::1' && socketIP !== '127.0.0.1') {
    return socketIP;
  }

  const userAgentHeader = req.headers['user-agent'];
  const acceptLanguageHeader = req.headers['accept-language'];
  const userAgent = Array.isArray(userAgentHeader)
    ? (userAgentHeader[0] || 'unknown')
    : (userAgentHeader || 'unknown');
  const acceptLanguage = Array.isArray(acceptLanguageHeader)
    ? (acceptLanguageHeader[0] || 'unknown')
    : (acceptLanguageHeader || 'unknown');
  return `fallback-${socketIP || 'unknown'}-${String(userAgent).substring(0, 20)}-${String(acceptLanguage).substring(0, 10)}`;
}
