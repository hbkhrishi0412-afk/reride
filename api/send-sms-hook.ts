import type { VercelRequest, VercelResponse } from '@vercel/node';
import { attachApiCors } from '../utils/attach-api-cors.js';
import { respondToSendSmsHook } from '../server/sendSmsHook.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  attachApiCors(req, res);

  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', '0');
    }
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({
      error: { http_code: 405, message: 'Method not allowed' },
    });
  }

  let raw: string;
  try {
    raw = await readRawBody(req);
  } catch {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({
      error: { http_code: 400, message: 'Could not read request body' },
    });
  }

  await respondToSendSmsHook(raw, req.headers as Record<string, string | string[] | undefined>, res);
}
