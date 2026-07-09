import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function signingSecret(): string | null {
  const secret = process.env.JWT_SECRET?.trim();
  return secret || null;
}

function encodePayload(vehicleId: number, databaseId?: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = JSON.stringify({
    v: vehicleId,
    ...(databaseId ? { d: databaseId } : {}),
    exp,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function signPayload(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url');
}

/** Issue a short-lived HMAC token proving the client loaded a published listing. */
export function issueViewTrackToken(vehicleId: number, databaseId?: string): string | undefined {
  const secret = signingSecret();
  if (!secret || !Number.isFinite(vehicleId)) return undefined;
  const encoded = encodePayload(vehicleId, databaseId);
  return `${encoded}.${signPayload(encoded, secret)}`;
}

export function verifyViewTrackToken(
  token: string | undefined,
  vehicleId: number,
  databaseId?: string,
): boolean {
  const secret = signingSecret();
  if (!secret || !token || typeof token !== 'string') return false;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;

  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = signPayload(encoded, secret);

  try {
    const sigBuf = Buffer.from(signature, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      v?: number;
      d?: string;
      exp?: number;
    };
    if (payload.v !== vehicleId) return false;
    if (databaseId && payload.d !== databaseId) return false;
    if (!payload.exp || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/** Attach view-track tokens to published vehicles returned to clients. */
export function attachViewTrackTokens<T extends { id: number; databaseId?: string }>(
  vehicles: T[],
): Array<T & { viewTrackToken?: string }> {
  return vehicles.map((v) => {
    const viewTrackToken = issueViewTrackToken(v.id, v.databaseId);
    return viewTrackToken ? { ...v, viewTrackToken } : v;
  });
}
