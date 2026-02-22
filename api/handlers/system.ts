/**
 * api/handlers/system.ts — System, health, AI/Gemini, test-connection, and utility handlers
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logError } from '../../utils/logger.js';
import { USE_SUPABASE, adminRead, adminCreate, adminUpdate, adminDelete, DB_PATHS, HandlerOptions } from './shared';

// ── Health (merged from health.ts) ─────────────────────────────────────────
export async function handleHealth(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!USE_SUPABASE) {
      return res.status(500).json({
        status: 'error',
        message: 'Database is not configured.',
        timestamp: new Date().toISOString(),
      });
    }
    await adminRead(DB_PATHS.USERS, 'test');
    return res.status(200).json({
      status: 'ok',
      message: 'Database connected successfully.',
      database: 'Supabase',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}

// ── AI / Gemini (merged from ai.ts) ───────────────────────────────────────
export async function handleAI(
  req: VercelRequest,
  res: VercelResponse,
) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/gemini') || pathname.endsWith('/gemini')) {
    return await handleGemini(req, res);
  }

  return res
    .status(404)
    .json({ success: false, reason: 'AI endpoint not found' });
}

async function handleGemini(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, reason: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      reason:
        'Gemini API key is not configured. Set GEMINI_API_KEY in environment variables.',
    });
  }

  try {
    const { prompt, model = 'gemini-2.0-flash' } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res
        .status(400)
        .json({ success: false, reason: 'Prompt is required.' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        reason: `Gemini API error: ${response.status}`,
        error: errorText,
      });
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    return res.status(200).json({
      success: true,
      response: text,
      model,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError('Gemini handler error:', error);
    return res.status(500).json({
      success: false,
      reason: 'Failed to process AI request',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ── System & utils ─────────────────────────────────────────────────────────
export async function handleSystem(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const { action } = req.query;
  switch (action) {
    case 'health':
      return await handleHealth(req, res);
    case 'test-connection':
      return await handleTestConnection(req, res);
    default:
      return res.status(400).json({ success: false, error: 'Invalid system action' });
  }
}

export async function handleUtils(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/test-connection')) {
    return await handleTestConnection(req, res);
  } else if (pathname.includes('/test-firebase-writes')) {
    return await handleTestFirebaseWrites(req, res);
  }
  return res.status(404).json({ success: false, reason: 'Utility endpoint not found' });
}

async function handleTestConnection(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!USE_SUPABASE) {
      return res.status(503).json({ success: false, message: 'Database not configured', timestamp: new Date().toISOString() });
    }
    await adminRead(DB_PATHS.USERS, 'test');
    return res.status(200).json({ success: true, message: 'Connection test successful', timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Connection test failed', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
  }
}

async function handleTestFirebaseWrites(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed. Use POST.' });
  }
  if (!USE_SUPABASE) {
    return res.status(503).json({ success: false, message: 'Database not configured' });
  }

  const testCollection = 'test_firebase_writes';
  const testId = `test_${Date.now()}`;
  type TestData = { testField: string; testNumber: number; testBoolean: boolean; createdAt?: string; updatedAt?: string };

  const results: Record<string, { success: boolean; error?: string }> = { create: { success: false }, update: { success: false }, modify: { success: false }, delete: { success: false } };

  try {
    // CREATE
    await adminCreate(testCollection, { testField: 'original_value', testNumber: 100, testBoolean: true, createdAt: new Date().toISOString() }, testId);
    const created = await adminRead<TestData>(testCollection, testId);
    results.create = { success: created?.testField === 'original_value' };

    // UPDATE
    if (results.create.success) {
      await adminUpdate(testCollection, testId, { testField: 'updated_value', testNumber: 200, updatedAt: new Date().toISOString() });
      const updated = await adminRead<TestData>(testCollection, testId);
      results.update = { success: updated?.testField === 'updated_value' };
    }

    // MODIFY
    if (results.update.success) {
      await adminUpdate(testCollection, testId, { testNumber: 300 });
      const modified = await adminRead<TestData>(testCollection, testId);
      results.modify = { success: modified?.testNumber === 300 && modified?.testField === 'updated_value' };
    }

    // DELETE
    if (results.create.success) {
      await adminDelete(testCollection, testId);
      const deleted = await adminRead(testCollection, testId);
      results.delete = { success: !deleted };
    }

    const passed = Object.values(results).filter(r => r.success).length;
    const total = Object.keys(results).length;
    return res.status(passed === total ? 200 : 500).json({ success: passed === total, message: `${passed}/${total} tests passed`, results, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Write test failed', error: error instanceof Error ? error.message : 'Unknown', timestamp: new Date().toISOString() });
  }
}

