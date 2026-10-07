const mockUpload = jest.fn(async () => ({ error: null }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      }),
    },
  }),
}));

process.env.SUPABASE_URL = 'https://abc.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('uploads real images and rejects spoofed data URLs', async () => {
  // The admin client refuses to run where `window` exists (browser guard).
  Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });
  // Required after jest.mock: the esbuild transform does not hoist mocks above imports.
  const { uploadDataUrlImage } = require('../lib/supabase-admin') as typeof import('../lib/supabase-admin');
  const url = await uploadDataUrlImage(`data:image/jpeg;base64,${PNG_BYTES.toString('base64')}`, 'a@x.com/profile');
  expect(url).toMatch(/^https:\/\/cdn\.test\/a@x\.com\/profile\/\d+_[0-9a-f]{16}\.png$/);
  expect(mockUpload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), expect.objectContaining({ contentType: 'image/png' }));

  const html = Buffer.from('<script>alert(1)</script>').toString('base64');
  await expect(uploadDataUrlImage(`data:image/png;base64,${html}`, 'a@x.com/profile')).rejects.toThrow(/Only JPEG/);
  await expect(uploadDataUrlImage('https://example.com/a.png', 'a@x.com/profile')).rejects.toThrow(/Unsupported/);
});
