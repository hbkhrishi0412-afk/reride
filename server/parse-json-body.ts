import type { VercelRequest } from '@vercel/node';

export class InvalidJsonBodyError extends Error {
  readonly statusCode = 400;
  constructor() {
    super('Invalid JSON body');
    this.name = 'InvalidJsonBodyError';
  }
}

export function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  try {
    const raw = req.body;
    if (raw == null || raw === '') return {};
    if (typeof raw === 'string') {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new InvalidJsonBodyError();
      }
      return parsed as Record<string, unknown>;
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    throw new InvalidJsonBodyError();
  } catch (err) {
    if (err instanceof InvalidJsonBodyError) throw err;
    throw new InvalidJsonBodyError();
  }
}
