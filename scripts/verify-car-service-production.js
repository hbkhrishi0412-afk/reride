/**
 * Production verification for car-service provider flows.
 *
 * Usage:
 *   node scripts/verify-car-service-production.js
 *
 * Required env:
 *   CAR_SERVICE_BASE_URL=https://www.reride.co.in
 *   CAR_SERVICE_PROVIDER_BEARER=<provider access token>   (prod mode)
 *
 * Optional env:
 *   CAR_SERVICE_ADMIN_BEARER=<admin access token>   (for metrics check)
 *   CAR_SERVICE_DEV_UID=<mock uid>                  (local mode, default: dev-uid)
 */

const baseUrl = (process.env.CAR_SERVICE_BASE_URL || '').replace(/\/+$/, '');
const providerBearer = process.env.CAR_SERVICE_PROVIDER_BEARER || '';
const adminBearer = process.env.CAR_SERVICE_ADMIN_BEARER || '';
const devUid = process.env.CAR_SERVICE_DEV_UID || 'dev-uid';
const isLocal =
  baseUrl.includes('localhost') ||
  baseUrl.includes('127.0.0.1');

if (!baseUrl) {
  console.error('Missing required env: CAR_SERVICE_BASE_URL');
  process.exit(1);
}

if (!isLocal && !providerBearer) {
  console.error('Missing required env.');
  console.error('Set CAR_SERVICE_BASE_URL and CAR_SERVICE_PROVIDER_BEARER for production verification.');
  process.exit(1);
}

const headers = (token, json = false) => {
  const base = json ? { 'Content-Type': 'application/json' } : {};
  if (isLocal) {
    return {
      ...base,
      'x-dev-uid': devUid,
    };
  }
  return {
    ...base,
    Authorization: `Bearer ${token}`,
  };
};

async function readJsonSafe(resp) {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

async function assertOk(step, resp, details = '') {
  if (!resp.ok) {
    const body = await readJsonSafe(resp);
    throw new Error(`${step} failed (${resp.status}) ${details} ${JSON.stringify(body)}`);
  }
}

async function main() {
  const results = [];
  const logPass = (s) => {
    results.push({ step: s, ok: true });
    console.log(`PASS: ${s}`);
  };
  const logSkip = (s) => {
    results.push({ step: s, ok: true, skip: true });
    console.log(`SKIP: ${s}`);
  };

  console.log(`Running car-service verification against ${baseUrl}`);

  // 1) Provider profile read
  const mineResp = await fetch(`${baseUrl}/api/service-providers`, {
    method: 'GET',
    headers: headers(providerBearer),
  });
  await assertOk('provider profile read', mineResp);
  const mine = await readJsonSafe(mineResp);
  if (!mine?.email) {
    throw new Error('provider profile read returned no email');
  }
  logPass('provider profile read');

  // 2) Provider profile patch (safe, idempotent)
  const patchBody = {
    email: mine.email,
    city: mine.city || 'Mumbai',
    availability: mine.availability || 'weekdays',
  };
  const patchResp = await fetch(`${baseUrl}/api/service-providers`, {
    method: 'PATCH',
    headers: headers(providerBearer, true),
    body: JSON.stringify(patchBody),
  });
  await assertOk('provider profile patch', patchResp);
  logPass('provider profile patch');

  // 3) Service category patch
  const categoryResp = await fetch(`${baseUrl}/api/service-providers`, {
    method: 'PATCH',
    headers: headers(providerBearer, true),
    body: JSON.stringify({
      email: mine.email,
      serviceCategories: ['Essential Service'],
    }),
  });
  await assertOk('service categories patch', categoryResp);
  logPass('service categories patch');

  // 4) Provider services create/update
  const testServiceType = `qa_tmp_${Date.now()}`;
  const upsertResp = await fetch(`${baseUrl}/api/provider-services`, {
    method: 'PATCH',
    headers: headers(providerBearer, true),
    body: JSON.stringify({
      serviceType: testServiceType,
      price: 999,
      etaMinutes: 60,
      description: 'QA temporary service',
      active: true,
    }),
  });
  await assertOk('provider service upsert', upsertResp);
  logPass('provider service upsert');

  // 5) Provider services delete
  const deleteResp = await fetch(
    `${baseUrl}/api/provider-services?serviceType=${encodeURIComponent(testServiceType)}`,
    {
      method: 'DELETE',
      headers: headers(providerBearer),
    },
  );
  await assertOk('provider service delete', deleteResp);
  logPass('provider service delete');

  // 6) Open request fetch
  const openResp = await fetch(`${baseUrl}/api/service-requests?scope=open&recentHours=24`, {
    method: 'GET',
    headers: headers(providerBearer),
  });
  await assertOk('open requests fetch', openResp);
  const openRows = await readJsonSafe(openResp);
  if (!Array.isArray(openRows)) {
    throw new Error('open requests fetch did not return an array');
  }
  logPass('open requests fetch');

  // 7) Admin metrics fetch (optional)
  if (!isLocal && adminBearer) {
    const metricsResp = await fetch(`${baseUrl}/api/service-requests?scope=metrics`, {
      method: 'GET',
      headers: headers(adminBearer),
    });
    await assertOk('admin metrics fetch', metricsResp);
    const metrics = await readJsonSafe(metricsResp);
    if (!metrics?.totals) {
      throw new Error('admin metrics fetch missing totals');
    }
    logPass('admin metrics fetch');
  } else {
    logSkip(isLocal ? 'admin metrics fetch (skipped in local mode)' : 'admin metrics fetch (missing CAR_SERVICE_ADMIN_BEARER)');
  }

  console.log('\nVerification complete.');
  const passed = results.filter((r) => r.ok).length;
  console.log(`Checks: ${passed}/${results.length} successful`);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});

