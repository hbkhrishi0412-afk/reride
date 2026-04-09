import { test, expect } from '@playwright/test';

test.describe('Service provider workflow', () => {
  test('runs customer to provider lifecycle via API', async ({ request }, testInfo) => {
    const apiBase = 'http://127.0.0.1:3001/api';
    const runId = `${Date.now()}-${testInfo.project.name.replace(/\s+/g, '-').toLowerCase()}`;
    const providerUid = `sp-${runId}`;
    const outsiderUid = `sp-outsider-${runId}`;
    const customerEmail = `customer-${runId}@test.local`;
    const assertOk = async (resp: any, label: string) => {
      if (!resp.ok()) {
        const body = await resp.text();
        throw new Error(`${label} failed: ${resp.status()} ${resp.statusText()} :: ${body}`);
      }
    };

    // Create a provider profile that should receive the request.
    const providerCreateResp = await request.post(`${apiBase}/service-providers?uid=${providerUid}`, {
      data: {
        name: 'Provider One',
        email: `provider-${runId}@test.local`,
        phone: '9999999999',
        city: 'Mock City',
        workshops: ['WS1'],
        skills: ['Essential Service'],
        availability: 'weekdays',
      },
    });
    await assertOk(providerCreateResp, 'provider create');

    // Create a second provider to validate candidate filtering/authorization.
    const outsiderCreateResp = await request.post(`${apiBase}/service-providers?uid=${outsiderUid}`, {
      data: {
        name: 'Provider Two',
        email: `provider-outsider-${runId}@test.local`,
        phone: '8888888888',
        city: 'Mock City',
        workshops: ['WS2'],
        skills: ['Deep Detailing'],
        availability: 'weekdays',
      },
    });
    await assertOk(outsiderCreateResp, 'outsider create');

    // Customer submits an open request broadcast to all providers (no candidate restriction).
    const createRequestResp = await request.post(`${apiBase}/service-requests`, {
      data: {
        title: 'Essential Service booking',
        serviceType: 'Essential Service',
        customerName: 'Test Customer',
        customerPhone: '7777777777',
        customerEmail,
        vehicle: 'Honda City',
        city: 'Mock City',
        addressLine: '221B Test Street',
        pincode: '560001',
        candidateProviderIds: [],
        providerId: null,
        status: 'open',
        scheduledAt: 'slot-1',
        notes: 'Please inspect brakes',
      },
    });
    await assertOk(createRequestResp, 'service request create');
    const created = await createRequestResp.json();
    expect(created.status).toBe('open');
    expect(created.providerId).toBeNull();

    // Any provider in the open pool can see the broadcast request.
    const providerOpenResp = await request.get(`${apiBase}/service-requests?scope=open&uid=${providerUid}`);
    await assertOk(providerOpenResp, 'provider open requests fetch');
    const providerOpen = await providerOpenResp.json();
    const openForProvider = providerOpen.find((r: any) => r.id === created.id);
    expect(openForProvider).toBeTruthy();

    const outsiderOpenResp = await request.get(`${apiBase}/service-requests?scope=open&uid=${outsiderUid}`);
    await assertOk(outsiderOpenResp, 'outsider open requests fetch');
    const outsiderOpen = await outsiderOpenResp.json();
    const openForOutsider = outsiderOpen.find((r: any) => r.id === created.id);
    expect(openForOutsider).toBeTruthy();

    // First claim wins; second provider gets a conflict.
    const claimResp = await request.patch(`${apiBase}/service-requests?uid=${providerUid}`, {
      data: { id: created.id, action: 'claim' },
    });
    await assertOk(claimResp, 'provider claim request');
    const claimed = await claimResp.json();
    expect(claimed.status).toBe('accepted');
    expect(claimed.providerId).toBe(providerUid);

    const outsiderClaimResp = await request.patch(`${apiBase}/service-requests?uid=${outsiderUid}`, {
      data: { id: created.id, action: 'claim' },
    });
    expect(outsiderClaimResp.status()).toBe(409);

    const inProgressResp = await request.patch(`${apiBase}/service-requests?uid=${providerUid}`, {
      data: { id: created.id, status: 'in_progress' },
    });
    await assertOk(inProgressResp, 'provider mark in_progress');
    const inProgress = await inProgressResp.json();
    expect(inProgress.status).toBe('in_progress');

    const completedResp = await request.patch(`${apiBase}/service-requests?uid=${providerUid}`, {
      data: { id: created.id, status: 'completed' },
    });
    await assertOk(completedResp, 'provider mark completed');
    const completed = await completedResp.json();
    expect(completed.status).toBe('completed');
    expect(completed.providerId).toBe(providerUid);

    // Final verification: it appears in provider's "mine" scope.
    const mineResp = await request.get(`${apiBase}/service-requests?uid=${providerUid}`);
    await assertOk(mineResp, 'provider mine requests fetch');
    const mine = await mineResp.json();
    const finalRecord = mine.find((r: any) => r.id === created.id);
    expect(finalRecord).toBeTruthy();
    expect(finalRecord.status).toBe('completed');
  });

  test('open pool respects candidateProviderIds', async ({ request }, testInfo) => {
    const apiBase = 'http://127.0.0.1:3001/api';
    const runId = `${Date.now()}-cand-${testInfo.project.name.replace(/\s+/g, '-').toLowerCase()}`;
    const providerUid = `sp-cand-${runId}`;
    const outsiderUid = `sp-cand-out-${runId}`;

    await request.post(`${apiBase}/service-providers?uid=${providerUid}`, {
      data: {
        name: 'Invited Provider',
        email: `invited-${runId}@test.local`,
        phone: '9111111111',
        city: 'Cand City',
        workshops: [],
        skills: [],
        availability: 'weekdays',
      },
    });
    await request.post(`${apiBase}/service-providers?uid=${outsiderUid}`, {
      data: {
        name: 'Other Provider',
        email: `other-${runId}@test.local`,
        phone: '9222222222',
        city: 'Cand City',
        workshops: [],
        skills: [],
        availability: 'weekdays',
      },
    });

    const createResp = await request.post(`${apiBase}/service-requests`, {
      data: {
        title: 'Invite-only job',
        serviceType: 'General',
        customerName: 'C',
        customerPhone: '7333333333',
        customerEmail: `c-${runId}@test.local`,
        city: 'Cand City',
        candidateProviderIds: [providerUid],
        providerId: null,
        status: 'open',
      },
    });
    expect(createResp.ok()).toBeTruthy();
    const created = await createResp.json();

    const invitedOpen = await (
      await request.get(`${apiBase}/service-requests?scope=open&uid=${providerUid}`)
    ).json();
    expect(invitedOpen.some((r: { id: string }) => r.id === created.id)).toBeTruthy();

    const outsiderOpen = await (
      await request.get(`${apiBase}/service-requests?scope=open&uid=${outsiderUid}`)
    ).json();
    expect(outsiderOpen.some((r: { id: string }) => r.id === created.id)).toBeFalsy();

    const outsiderClaim = await request.patch(`${apiBase}/service-requests?uid=${outsiderUid}`, {
      data: { id: created.id, action: 'claim' },
    });
    expect(outsiderClaim.status()).toBe(403);
  });
});


