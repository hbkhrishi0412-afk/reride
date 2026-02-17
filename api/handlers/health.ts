/**
 * api/handlers/health.ts — Health check endpoint handler
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { USE_SUPABASE, adminRead, DB_PATHS } from './shared';

export async function handleHealth(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!USE_SUPABASE) {
      return res.status(500).json({
        status: 'error',
        message: 'Database is not configured.',
        timestamp: new Date().toISOString(),
      });
    }

    // Test database connection
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

