import type { VercelRequest, VercelResponse } from '@vercel/node';

export type DealHandlerContext = {
  req: VercelRequest;
  res: VercelResponse;
  subPath: string;
  method: string;
};

export type DealActionHandler = (ctx: DealHandlerContext) => Promise<boolean>;

export function parseBody(req: VercelRequest): Record<string, unknown> {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}
