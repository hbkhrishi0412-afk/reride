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

    // Customer submits a request targeted to providerUid.
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
        candidateProviderIds: [providerUid],
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
    expect(created.candidateProviderIds).toContain(providerUid);

    // Assigned provider can see it in open pool.
    const providerOpenResp = await request.get(`${apiBase}/service-requests?scope=open&uid=${providerUid}`);
    await assertOk(providerOpenResp, 'provider open requests fetch');
    const providerOpen = await providerOpenResp.json();
    const openForProvider = providerOpen.find((r: any) => r.id === created.id);
    expect(openForProvider).toBeTruthy();

    // Outsider should neither see nor claim that request.
    const outsiderOpenResp = await request.get(`${apiBase}/service-requests?scope=open&uid=${outsiderUid}`);
    await assertOk(outsiderOpenResp, 'outsider open requests fetch');
    const outsiderOpen = await outsiderOpenResp.json();
    const openForOutsider = outsiderOpen.find((r: any) => r.id === created.id);
    expect(openForOutsider).toBeFalsy();

    const outsiderClaimResp = await request.patch(`${apiBase}/service-requests?uid=${outsiderUid}`, {
      data: { id: created.id, action: 'claim' },
    });
    expect(outsiderClaimResp.status()).toBe(403);

    // Assigned provider claims and progresses request lifecycle.
    const claimResp = await request.patch(`${apiBase}/service-requests?uid=${providerUid}`, {
      data: { id: created.id, action: 'claim' },
    });
    await assertOk(claimResp, 'provider claim request');
    const claimed = await claimResp.json();
    expect(claimed.status).toBe('accepted');
    expect(claimed.providerId).toBe(providerUid);

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
});


