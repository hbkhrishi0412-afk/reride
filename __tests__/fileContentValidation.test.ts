import { detectBufferContentType } from '../utils/fileContentValidation';

describe('fileContentValidation', () => {
  it('detects JPEG magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectBufferContentType(buf)).toBe('image/jpeg');
  });

  it('detects PNG magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectBufferContentType(buf)).toBe('image/png');
  });

  it('returns null for unknown content', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectBufferContentType(buf)).toBeNull();
  });
});
