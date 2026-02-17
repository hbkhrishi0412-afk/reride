/**
 * api/handlers/system.ts — System, test-connection, and utility handlers
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { USE_SUPABASE, adminRead, adminCreate, adminUpdate, adminDelete, DB_PATHS, HandlerOptions } from './shared';
import { handleHealth } from './health';

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

