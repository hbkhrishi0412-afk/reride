const COOKIE_NAME = 'reride_chat_session';
const MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

export function getChatSessionCookieName(): string {
  return COOKIE_NAME;
}

export function parseChatSessionFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const prefix = `${COOKIE_NAME}=`;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  if (!match) return undefined;
  const value = match.slice(prefix.length).trim();
  return value || undefined;
}

export function buildChatSessionSetCookie(sessionId: string, reqProto?: string): string {
  const useSecure = reqProto === 'https' || process.env.VERCEL === '1';
  const sameSite = useSecure ? 'None' : 'Lax';
  const secureSuffix = useSecure ? '; Secure' : '';
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${MAX_AGE_SEC}${secureSuffix}`;
}
