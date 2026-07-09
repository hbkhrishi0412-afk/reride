/**
 * server/handlers/support-chat.ts — Support widget chat (Supabase-backed, replaces MongoDB api/chat.js)
 */
import { randomBytes } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequestDual } from '../../api/auth.js';
import { sanitizeString } from '../../utils/security.js';
import { resolveRateLimit } from '../../lib/rate-limit-resolver.js';
import { getSecurityConfig } from '../../utils/security-config.js';
import { supabaseSupportChatService } from '../../services/supabase-support-chat-service.js';
import { generateBotResponse } from '../utils/support-bot-responses.js';
import { USE_SUPABASE } from '../handler-shared.js';
import { getTrustedClientIP } from '../../utils/trusted-client-ip.js';
import {
  buildChatSessionSetCookie,
  parseChatSessionFromCookie,
} from '../../utils/chat-session-cookie.js';
import { supportChatHistoryQuerySchema, supportChatPostSchema } from '../../utils/api-schemas.js';

const MAX_MESSAGE_LENGTH = 2000;

function getClientIp(req: VercelRequest): string {
  return getTrustedClientIP(req);
}

function sessionIpFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  const ip = metadata?.ipAddress;
  return typeof ip === 'string' && ip.length > 0 ? ip : undefined;
}

function sessionTokenFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  const token = metadata?.sessionToken;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

async function assertSessionOwnership(
  sessionId: string,
  requestIp: string,
  cookieSessionId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const session = await supabaseSupportChatService.getSession(sessionId);
  if (!session) {
    return { ok: false, status: 404, error: 'Session not found' };
  }
  const storedIp = sessionIpFromMetadata(session.metadata);
  if (storedIp && storedIp !== requestIp) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  const storedToken = sessionTokenFromMetadata(session.metadata);
  if (storedToken && cookieSessionId !== sessionId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true };
}

function chatSubPath(req: VercelRequest): string {
  const raw = req.url ?? '';
  const pathOnly = raw.split('?')[0] ?? '';
  const idx = pathOnly.indexOf('/chat');
  const tail = idx >= 0 ? pathOnly.slice(idx + '/chat'.length) : '';
  return tail.replace(/\/$/, '') || '/';
}

async function sanitizeChatMessage(raw: unknown): Promise<string> {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  return sanitizeString(trimmed.slice(0, MAX_MESSAGE_LENGTH));
}

async function checkChatRateLimit(
  bucket: 'CHAT_POST' | 'CHAT_HISTORY',
  ip: string,
): Promise<{ allowed: boolean }> {
  const limits = getSecurityConfig().ENDPOINT_RATE_LIMITS[bucket];
  const prefix = bucket === 'CHAT_POST' ? 'chat-post' : 'chat-history';
  const result = await resolveRateLimit(prefix, ip, limits);
  return { allowed: result.allowed };
}

async function handlePostMessage(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIp(req);
  const rate = await checkChatRateLimit('CHAT_POST', ip);
  if (!rate.allowed) {
    return res.status(429).json({ success: false, error: 'Too many messages. Please wait and try again.' });
  }

  const parsed = supportChatPostSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request body' });
  }
  const body = parsed.data;

  const safeMessage = await sanitizeChatMessage(body.message);
  if (!safeMessage) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const cookieSessionId = parseChatSessionFromCookie(req.headers.cookie);
  let sessionId = body.sessionId || cookieSessionId;
  const isNewSession = !sessionId;
  if (!sessionId) {
    sessionId = body.userId
      ? `user_${body.userId}_${Date.now()}`
      : `anon_${Date.now()}_${randomBytes(9).toString('hex')}`;
  } else {
    const ownership = await assertSessionOwnership(sessionId, ip, cookieSessionId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ success: false, error: ownership.error });
    }
  }

  const userName = (await sanitizeString(String(body.userName ?? 'Guest').slice(0, 120))) || 'Guest';
  const userId = body.userId || undefined;
  const meta = {
    ipAddress: ip,
    userAgent: req.headers['user-agent'] ?? '',
    sessionToken: sessionId,
  };

  await supabaseSupportChatService.upsertSession({ sessionId, userId, userName, metadata: meta });
  await supabaseSupportChatService.addMessage({
    sessionId,
    userId,
    userName,
    message: safeMessage,
    sender: 'user',
    metadata: meta,
  });

  const botResponseText = await generateBotResponse(safeMessage, userName);
  const botRow = await supabaseSupportChatService.addMessage({
    sessionId,
    userId,
    userName: 'Support Bot',
    message: botResponseText,
    sender: 'bot',
  });

  if (isNewSession || cookieSessionId !== sessionId) {
    const proto = (req.headers['x-forwarded-proto'] as string) || '';
    res.setHeader('Set-Cookie', buildChatSessionSetCookie(sessionId, proto));
  }

  return res.status(200).json({
    success: true,
    response: botResponseText,
    sessionId,
    messageId: botRow.id,
  });
}

async function handleGetHistory(req: VercelRequest, res: VercelResponse) {
  const queryParsed = supportChatHistoryQuerySchema.safeParse(req.query ?? {});
  if (!queryParsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid query parameters' });
  }
  const { userId, sessionId: querySessionId } = queryParsed.data;
  const cookieSessionId = parseChatSessionFromCookie(req.headers.cookie);
  const sessionId = querySessionId || cookieSessionId;

  if (!userId && !sessionId) {
    return res.status(400).json({ success: false, error: 'userId or sessionId is required' });
  }

  const auth = await authenticateRequestDual(req);
  if (userId) {
    if (!auth.isValid) {
      return res.status(401).json({ success: false, error: 'Authentication required for user history' });
    }
    const authed = String(auth.user?.userId ?? auth.user?.email ?? '');
    if (authed !== userId && auth.user?.role !== 'admin' && auth.user?.email !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
  } else if (sessionId) {
    const ip = getClientIp(req);
    const rate = await checkChatRateLimit('CHAT_HISTORY', ip);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, error: 'Too many requests' });
    }
    const ownership = await assertSessionOwnership(sessionId, ip, cookieSessionId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ success: false, error: ownership.error });
    }
  }

  const rows = userId
    ? await supabaseSupportChatService.getMessagesByUserId(userId)
    : await supabaseSupportChatService.getMessagesBySession(sessionId!);

  const formattedMessages = rows.map((msg) => ({
    id: msg.id,
    text: msg.message,
    sender: msg.sender,
    timestamp: msg.created_at,
    isRead: msg.is_read ?? false,
  }));

  return res.status(200).json({
    success: true,
    messages: formattedMessages,
    count: formattedMessages.length,
  });
}

async function handleGetSessions(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateRequestDual(req);
  if (!auth.isValid || auth.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin authentication required' });
  }

  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const status = req.query.status ? String(req.query.status) : 'active';
  const limit = parseInt(String(req.query.limit ?? '50'), 10) || 50;

  const sessions = await supabaseSupportChatService.listSessions({ userId, status, limit });
  return res.status(200).json({ success: true, sessions, count: sessions.length });
}

export async function handleSupportChat(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!USE_SUPABASE) {
    res.status(503).json({
      success: false,
      error: 'Support chat requires Supabase. Apply scripts/migrations/add-support-chat-and-postgis.sql',
    });
    return;
  }

  try {
    const sub = chatSubPath(req);
    if (req.method === 'POST' && (sub === '/' || sub === '')) {
      await handlePostMessage(req, res);
      return;
    }
    if (req.method === 'GET' && sub === '/history') {
      await handleGetHistory(req, res);
      return;
    }
    if (req.method === 'GET' && sub === '/sessions') {
      await handleGetSessions(req, res);
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ success: false, error: `Method ${req.method} not allowed for ${sub || '/chat'}` });
  } catch (error) {
    console.error('Support chat API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to process support chat request',
      message: process.env.NODE_ENV === 'development' ? message : 'An error occurred',
    });
  }
}

/** @deprecated Use handleSupportChat — kept for any stale imports */
export const handleChat = handleSupportChat;
