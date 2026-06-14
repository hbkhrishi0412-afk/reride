/**
 * Indian Blue Book (IBB) — Mahindra First Choice enterprise valuation API client.
 *
 * IBB does not offer a public self-service API. Enterprise access requires a
 * partnership with Mahindra First Choice Wheels (help.mfcw@mahindra.com / 9930565555).
 *
 * Configure when credentials are issued:
 *   IBB_API_BASE_URL  — e.g. https://api.mahindrafirstchoice.com/ibb
 *   IBB_API_KEY       — bearer or API key
 *   IBB_API_PATH      — optional, default /api/v1/vehicle/valuation
 */

import type { Vehicle } from '../types.js';
import type { ExternalMarketBenchmark } from '../utils/vehiclePricing.js';

export const IBB_PUBLIC_VALUATION_URL = 'https://www.indianbluebook.com/';

export function isIndianBlueBookConfigured(): boolean {
  return Boolean(process.env.IBB_API_BASE_URL?.trim() && process.env.IBB_API_KEY?.trim());
}

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
    if (typeof v === 'string') {
      const n = Number(v.replace(/[,₹]/g, '').trim());
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  return null;
}

export function parseIndianBlueBookResponse(body: Record<string, unknown>): ExternalMarketBenchmark | null {
  const data =
    body.data && typeof body.data === 'object'
      ? (body.data as Record<string, unknown>)
      : body.result && typeof body.result === 'object'
        ? (body.result as Record<string, unknown>)
        : body;

  const usedFairAverage = pickNumber(
    data.usedFairAverage,
    data.fairMarketValue,
    data.fair_market_value,
    data.marketPrice,
    data.market_price,
    data.price,
    data.valuation,
    data.ibbPrice,
    data.ibb_price,
  );

  if (!usedFairAverage) return null;

  const usedFairLow = pickNumber(
    data.usedFairLow,
    data.minPrice,
    data.min_price,
    data.priceMin,
    data.lowerPrice,
    data.lower_price,
  );
  const usedFairHigh = pickNumber(
    data.usedFairHigh,
    data.maxPrice,
    data.max_price,
    data.priceMax,
    data.upperPrice,
    data.upper_price,
  );
  const newOnRoadPrice = pickNumber(
    data.newOnRoadPrice,
    data.onRoadPrice,
    data.on_road_price,
    data.newCarOnRoad,
    data.exShowroomOnRoad,
  );

  return {
    newOnRoadPrice: newOnRoadPrice ?? null,
    usedFairLow: usedFairLow ?? Math.round(usedFairAverage * 0.9),
    usedFairHigh: usedFairHigh ?? Math.round(usedFairAverage * 1.1),
    usedFairAverage,
    summary: 'Valuation from Indian Blue Book (IBB) — India’s industry-standard used vehicle pricing guide.',
    source: 'ibb',
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchIndianBlueBookValuation(
  vehicle: Pick<
    Vehicle,
    'make' | 'model' | 'variant' | 'year' | 'mileage' | 'city' | 'state' | 'fuelType' | 'transmission' | 'noOfOwners'
  >,
): Promise<ExternalMarketBenchmark | null> {
  if (!isIndianBlueBookConfigured()) return null;

  const baseUrl = process.env.IBB_API_BASE_URL!.replace(/\/$/, '');
  const path = (process.env.IBB_API_PATH || '/api/v1/vehicle/valuation').startsWith('/')
    ? process.env.IBB_API_PATH || '/api/v1/vehicle/valuation'
    : `/${process.env.IBB_API_PATH}`;

  const payload = {
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant || undefined,
    year: vehicle.year,
    manufacturingYear: vehicle.year,
    mileage: vehicle.mileage,
    kilometers: vehicle.mileage,
    city: vehicle.city || undefined,
    state: vehicle.state || undefined,
    fuelType: vehicle.fuelType || undefined,
    transmission: vehicle.transmission || undefined,
    owners: vehicle.noOfOwners || undefined,
    numberOfOwners: vehicle.noOfOwners || undefined,
  };

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.IBB_API_KEY}`,
        'X-API-Key': process.env.IBB_API_KEY!,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.warn('IBB API returned', response.status, await response.text().catch(() => ''));
      return null;
    }

    const body = (await response.json()) as Record<string, unknown>;
    return parseIndianBlueBookResponse(body);
  } catch (error) {
    console.warn('IBB valuation request failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
