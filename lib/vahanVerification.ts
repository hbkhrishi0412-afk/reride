/**
 * VAHAN / RC verification via Surepass (when configured) or structured manual fallback.
 */
import type { VahanSnapshot } from './vehicleDisclosureChecklist.js';

export function isVahanApiConfigured(): boolean {
  return Boolean(process.env.SUREPASS_API_TOKEN?.trim());
}

function baseUrl(): string {
  return (process.env.SUREPASS_API_BASE_URL || 'https://kyc-api.surepass.io').replace(/\/$/, '');
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${process.env.SUREPASS_API_TOKEN}`,
  };
}

function unwrapData(body: Record<string, unknown>): Record<string, unknown> {
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }
  return body;
}

function pickString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d]/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function pickBool(...values: unknown[]): boolean | undefined {
  for (const v of values) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s === 'yes' || s === 'true' || s === 'y') return true;
      if (s === 'no' || s === 'false' || s === 'n') return false;
    }
  }
  return undefined;
}

export function parseVahanFromSurepass(
  registrationNumber: string,
  body: Record<string, unknown>,
): VahanSnapshot | null {
  const data = unwrapData(body);
  const verifiedAt = new Date().toISOString();

  const ownerCount = pickNumber(
    data.owner_count,
    data.ownerCount,
    data.no_of_owner,
    data.number_of_owners,
  );

  const hypRaw = pickString(data.financer, data.hypothecation, data.financer_name);
  const hypothecation =
    pickBool(data.is_financed, data.hypothecation_status) ??
    Boolean(hypRaw && hypRaw.toLowerCase() !== 'na' && hypRaw.toLowerCase() !== 'none');

  const snapshot: VahanSnapshot = {
    registrationNumber: registrationNumber.toUpperCase(),
    ownerName: pickString(data.owner_name, data.ownerName, data.registered_owner),
    ownerCount,
    registrationDate: pickString(
      data.registration_date,
      data.registrationDate,
      data.reg_date,
    ),
    fuelType: pickString(data.fuel_type, data.fuelType, data.fuel),
    manufacturer: pickString(data.manufacturer, data.maker, data.make),
    model: pickString(data.model, data.model_name),
    fitnessUpto: pickString(data.fitness_upto, data.fitnessUpto, data.fitness_valid_upto),
    insuranceUpto: pickString(
      data.insurance_upto,
      data.insuranceUpto,
      data.insurance_valid_upto,
    ),
    hypothecation,
    hypothecationBank: hypothecation ? hypRaw : undefined,
    engineNumber: pickString(data.engine_number, data.engineNumber, data.engine_no),
    chassisNumber: pickString(data.chassis_number, data.chassisNumber, data.chassis_no),
    rtoCode: pickString(data.rto_code, data.rtoCode, data.rto),
    vehicleClass: pickString(data.vehicle_class, data.class, data.vehicle_category),
    verifiedAt,
    source: 'surepass',
    rawSummary: pickString(data.rc_status, data.status),
  };

  if (
    !snapshot.ownerName &&
    !snapshot.manufacturer &&
    !snapshot.engineNumber &&
    !snapshot.chassisNumber
  ) {
    return null;
  }

  return snapshot;
}

export async function fetchVahanByRegistration(
  registrationNumber: string,
): Promise<VahanSnapshot | null> {
  const rc = registrationNumber.trim().toUpperCase();
  if (!rc) return null;

  if (!isVahanApiConfigured()) {
    return null;
  }

  const path =
    process.env.SUREPASS_RC_DETAILS_PATH ||
    process.env.SUREPASS_RC_PATH ||
    '/api/v1/rc/rc-v2';

  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        rc_number: rc,
        id_number: rc,
        vehicle_number: rc,
        registration_number: rc,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.warn('Vahan/Surepass RC lookup failed', response.status);
      return null;
    }

    const body = (await response.json()) as Record<string, unknown>;
    return parseVahanFromSurepass(rc, body);
  } catch (error) {
    console.warn('Vahan lookup error', error instanceof Error ? error.message : error);
    return null;
  }
}
