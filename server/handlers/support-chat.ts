/**
 * server/handlers/support-chat.ts — Support widget chat (Supabase-backed, replaces MongoDB api/chat.js)
 */
import { randomBytes } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../../api/auth.js';
import { sanitizeString } from '../../utils/security.js';
import { checkUpstashRateLimit } from '../../lib/rate-limit-upstash.js';
import { supabaseSupportChatService } from '../../services/supabase-support-chat-service.js';
import { generateBotResponse } from '../utils/support-bot-responses.js';
import { USE_SUPABASE } from './shared.js';

const MAX_MESSAGE_LENGTH = 2000;

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
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

async function handlePostMessage(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIp(req);
  const rate = await checkUpstashRateLimit(`chat-post:${ip}`);
  if (!rate.allowed) {
    return res.status(429).json({ success: false, error: 'Too many messages. Please wait and try again.' });
  }

  const body = (req.body ?? {}) as {
    message?: string;
    userId?: string;
    userName?: string;
    sessionId?: string;
  };

  const safeMessage = await sanitizeChatMessage(body.message);
  if (!safeMessage) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  let sessionId = body.sessionId;
  if (!sessionId) {
    sessionId = body.userId
      ? `user_${body.userId}_${Date.now()}`
      : `anon_${Date.now()}_${randomBytes(9).toString('hex')}`;
  }

  const userName = (await sanitizeString(String(body.userName ?? 'Guest').slice(0, 120))) || 'Guest';
  const userId = body.userId || undefined;
  const meta = {
    ipAddress: ip,
    userAgent: req.headers['user-agent'] ?? '',
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

  return res.status(200).json({
    success: true,
    response: botResponseText,
    sessionId,
    messageId: botRow.id,
  });
}

async function handleGetHistory(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const sessionId = req.query.sessionId ? String(req.query.sessionId) : undefined;

  if (!userId && !sessionId) {
    return res.status(400).json({ success: false, error: 'userId or sessionId is required' });
  }

  const auth = authenticateRequest(req);
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
    const rate = await checkUpstashRateLimit(`chat-history:${ip}`);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, error: 'Too many requests' });
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
  const auth = authenticateRequest(req);
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
