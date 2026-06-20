/**
 * Surepass vehicle valuation APIs (IDV Calculator, Vehicle Price Check, RC-to-IDV).
 *
 * Sign up: https://surepass.io/get-api-key/
 * Base URL pattern: https://kyc-api.surepass.io/api/v1/...
 * Auth: Authorization: Bearer <SUREPASS_API_TOKEN>
 *
 * Set exact paths from your Surepass dashboard docs:
 *   SUREPASS_IDV_PATH
 *   SUREPASS_VEHICLE_PRICE_PATH
 *   SUREPASS_RC_TO_IDV_PATH
 */

import type { Vehicle } from '../types.js';
import type { ExternalMarketBenchmark } from '../utils/vehiclePricing.js';

export const SUREPASS_SIGNUP_URL = 'https://surepass.io/get-api-key/';

export function isSurepassConfigured(): boolean {
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

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
    if (typeof v === 'string') {
      const n = Number(v.replace(/[,₹\s]/g, '').trim());
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  return null;
}

function unwrapData(body: Record<string, unknown>): Record<string, unknown> {
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }
  return body;
}

export function parseSurepassValuationResponse(
  body: Record<string, unknown>,
  summaryPrefix = 'Valuation from Surepass',
): ExternalMarketBenchmark | null {
  const data = unwrapData(body);

  const idv = pickNumber(
    data.idv,
    data.idv_value,
    data.idvValue,
    data.insured_declared_value,
    data.market_value,
    data.fair_market_value,
  );
  const onRoad = pickNumber(
    data.on_road_price,
    data.onRoadPrice,
    data.onroad_price,
    data.road_price,
  );
  const exShowroom = pickNumber(
    data.ex_showroom_price,
    data.exShowroomPrice,
    data.showroom_price,
    data.ex_showroom,
  );
  const usedLow = pickNumber(data.min_price, data.price_min, data.lower_price, data.usedFairLow);
  const usedHigh = pickNumber(data.max_price, data.price_max, data.upper_price, data.usedFairHigh);
  const usedAvg = pickNumber(
    data.usedFairAverage,
    data.used_price,
    data.fair_price,
    data.market_price,
    idv,
  );

  const newOnRoadPrice = onRoad ?? exShowroom ?? null;
  if (!usedAvg && !newOnRoadPrice) return null;

  const fairAverage = usedAvg ?? (newOnRoadPrice ? Math.round(newOnRoadPrice * 0.72) : null);
  if (!fairAverage) return null;

  return {
    newOnRoadPrice,
    usedFairLow: usedLow ?? Math.round(fairAverage * 0.9),
    usedFairHigh: usedHigh ?? Math.round(fairAverage * 1.1),
    usedFairAverage: fairAverage,
    summary: `${summaryPrefix} — IDV/market value for this model year in India.`,
    source: 'surepass',
    fetchedAt: new Date().toISOString(),
  };
}

async function postSurepass(
  path: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (!path?.trim()) return null;

  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.warn('Surepass API', path, response.status, await response.text().catch(() => ''));
      return null;
    }

    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    console.warn('Surepass request failed', path, error instanceof Error ? error.message : error);
    return null;
  }
}

function vehiclePayload(
  vehicle: Pick<Vehicle, 'make' | 'model' | 'year'> &
    Partial<Pick<Vehicle, 'variant' | 'city' | 'state' | 'fuelType' | 'transmission' | 'color' | 'noOfOwners'>> & {
      mileage?: number;
      registrationNumber?: string;
    },
): Record<string, unknown> {
  return {
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant || undefined,
    vehicle_name: `${vehicle.make} ${vehicle.model}`.trim(),
    model_number: vehicle.model,
    model_name: vehicle.model,
    year: vehicle.year,
    manufacturing_year: vehicle.year,
    registration_year: vehicle.year,
    mileage: vehicle.mileage ?? 0,
    kilometers: vehicle.mileage ?? 0,
    km_driven: vehicle.mileage ?? 0,
    city: vehicle.city || undefined,
    state: vehicle.state || undefined,
    fuel_type: vehicle.fuelType || undefined,
    fuelType: vehicle.fuelType || undefined,
    transmission: vehicle.transmission || undefined,
    color: vehicle.color || undefined,
    owners: vehicle.noOfOwners || undefined,
    number_of_owners: vehicle.noOfOwners || undefined,
  };
}

async function fetchIdvValuation(
  vehicle: Pick<Vehicle, 'make' | 'model' | 'year' | 'mileage'> &
    Partial<Pick<Vehicle, 'variant' | 'city' | 'state' | 'fuelType' | 'transmission' | 'color' | 'noOfOwners'>>,
): Promise<ExternalMarketBenchmark | null> {
  const path = process.env.SUREPASS_IDV_PATH || '/api/v1/vehicle/idv-calculator';
  const body = await postSurepass(path, vehiclePayload(vehicle));
  return body ? parseSurepassValuationResponse(body, 'Used-car IDV from Surepass') : null;
}

async function fetchRcToIdv(
  registrationNumber: string,
): Promise<ExternalMarketBenchmark | null> {
  const path = process.env.SUREPASS_RC_TO_IDV_PATH || '/api/v1/rc/rc-to-idv';
  const body = await postSurepass(path, {
    rc_number: registrationNumber,
    vehicle_number: registrationNumber,
    registration_number: registrationNumber,
  });
  return body ? parseSurepassValuationResponse(body, 'RC-based IDV from Surepass') : null;
}

async function fetchNewVehiclePrice(
  vehicle: Pick<Vehicle, 'make' | 'model' | 'year'> &
    Partial<
      Pick<Vehicle, 'variant' | 'city' | 'state' | 'fuelType' | 'transmission' | 'color' | 'mileage' | 'noOfOwners'>
    >,
): Promise<number | null> {
  const path = process.env.SUREPASS_VEHICLE_PRICE_PATH || '/api/v1/vehicle/vehicle-price-check';
  const body = await postSurepass(path, vehiclePayload(vehicle));
  if (!body) return null;
  const parsed = parseSurepassValuationResponse(body, 'New vehicle price from Surepass');
  return parsed?.newOnRoadPrice ?? parsed?.usedFairAverage ?? null;
}

function mergeBenchmarks(
  primary: ExternalMarketBenchmark,
  newOnRoadFromPriceCheck: number | null,
): ExternalMarketBenchmark {
  if (!newOnRoadFromPriceCheck) return primary;
  return {
    ...primary,
    newOnRoadPrice: newOnRoadFromPriceCheck,
  };
}

export async function fetchSurepassVehicleValuation(
  vehicle: Pick<Vehicle, 'make' | 'model' | 'year' | 'mileage'> &
    Partial<
      Pick<
        Vehicle,
        'variant' | 'city' | 'state' | 'fuelType' | 'transmission' | 'color' | 'noOfOwners' | 'registrationNumber'
      >
    >,
): Promise<ExternalMarketBenchmark | null> {
  if (!isSurepassConfigured()) return null;

  const rcNumber = vehicle.registrationNumber?.trim().toUpperCase();
  const [rcIdv, modelIdv, newPrice] = await Promise.all([
    rcNumber ? fetchRcToIdv(rcNumber) : Promise.resolve(null),
    fetchIdvValuation(vehicle),
    fetchNewVehiclePrice(vehicle),
  ]);

  const primary = rcIdv ?? modelIdv;
  if (!primary) {
    if (!newPrice) return null;
    const yearsOld = Math.max(0, new Date().getFullYear() - vehicle.year);
    const retention = Math.max(0.25, 0.9 - yearsOld * 0.08);
    const fair = Math.round(newPrice * retention);
    return {
      newOnRoadPrice: newPrice,
      usedFairLow: Math.round(fair * 0.9),
      usedFairHigh: Math.round(fair * 1.1),
      usedFairAverage: fair,
      summary: 'New-car price from Surepass with age-adjusted used value estimate.',
      source: 'surepass',
      fetchedAt: new Date().toISOString(),
    };
  }

  return mergeBenchmarks(primary, newPrice);
}
