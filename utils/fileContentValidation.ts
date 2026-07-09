/**
 * Server-side file content sniffing (magic bytes).
 * Do not trust client-supplied MIME types for uploads.
 */

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]; // RIFF
const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50]; // WEBP at offset 8
const WEBM = [0x1a, 0x45, 0xdf, 0xa3];
const OGG = [0x4f, 0x67, 0x67, 0x53];
const MP3_ID3 = [0x49, 0x44, 0x33];
const WAV = [0x52, 0x49, 0x46, 0x46]; // RIFF + WAVE at 8

function startsWith(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    startsWith(buffer, WEBP_RIFF) &&
    startsWith(buffer, WEBP_MARKER, 8)
  );
}

function isWav(buffer: Buffer): boolean {
  return buffer.length >= 12 && startsWith(buffer, WAV) && buffer.toString('ascii', 8, 12) === 'WAVE';
}

function isMp4Family(buffer: Buffer): boolean {
  // ISO BMFF: ....ftyp at offset 4
  return buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
}

/**
 * Detect MIME type from buffer contents. Returns null if unknown.
 */
export function detectBufferContentType(buffer: Buffer): string | null {
  if (!buffer.length) return null;
  if (startsWith(buffer, JPEG)) return 'image/jpeg';
  if (startsWith(buffer, PNG)) return 'image/png';
  if (isWebp(buffer)) return 'image/webp';
  if (startsWith(buffer, WEBM)) return 'audio/webm';
  if (startsWith(buffer, OGG)) return 'audio/ogg';
  if (startsWith(buffer, MP3_ID3) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    return 'audio/mpeg';
  }
  if (isWav(buffer)) return 'audio/wav';
  if (isMp4Family(buffer)) return 'audio/mp4';
  return null;
}

export function isDetectedMimeAllowed(
  detected: string,
  allowedImageMime: string[],
  allowedAudioMime: string[],
): boolean {
  if (allowedImageMime.includes(detected)) return true;
  if (allowedAudioMime.includes(detected)) return true;
  // audio/mp4 covers m4a containers
  if (detected === 'audio/mp4' && allowedAudioMime.some((m) => m.includes('mp4') || m.includes('m4a'))) {
    return true;
  }
  return false;
}
