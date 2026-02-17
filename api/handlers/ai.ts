/**
 * api/handlers/ai.ts — AI / Gemini endpoint handlers
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logError } from '../../utils/logger.js';

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

