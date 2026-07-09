import { test, expect } from '@playwright/test';

const apiBase = () => process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001';

test.describe('Deal return lifecycle (API)', () => {
  test('request-return rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post(`${apiBase()}/api/deals?action=request-return`, {
      data: { leadId: 'RR-LD-001', reason: 'Buyer returned vehicle' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('resolve-return rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post(`${apiBase()}/api/deals?action=resolve-return`, {
      data: { leadId: 'RR-LD-001', action: 'relist' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('resolve-return rejects invalid action', async ({ request }) => {
    const response = await request.post(`${apiBase()}/api/deals?action=resolve-return`, {
      data: { leadId: 'RR-LD-001', action: 'invalid' },
    });
    expect([400, 401]).toContain(response.status());
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('request-return requires leadId', async ({ request }) => {
    const response = await request.post(`${apiBase()}/api/deals?action=request-return`, {
      data: { reason: 'test' },
    });
    expect([400, 401]).toContain(response.status());
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});

test.describe('Deal pipeline stage order (API)', () => {
  test('advance-stage still rejects unauthenticated deal completion', async ({ request }) => {
    const response = await request.post(`${apiBase()}/api/deals?action=advance-stage`, {
      data: { leadId: 'RR-LD-001', stage: 'deal_completed' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
