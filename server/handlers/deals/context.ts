import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseJsonBody } from '../../parse-json-body.js';

export type DealHandlerContext = {
  req: VercelRequest;
  res: VercelResponse;
  subPath: string;
  method: string;
};

export type DealActionHandler = (ctx: DealHandlerContext) => Promise<boolean>;

export { InvalidJsonBodyError } from '../../parse-json-body.js';

export function parseBody(req: VercelRequest): Record<string, unknown> {
  return parseJsonBody(req);
}
