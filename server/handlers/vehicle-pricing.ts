/**
 * Live vehicle market pricing — platform comparables + external market benchmark.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Vehicle } from '../../types.js';
import type { ExternalMarketBenchmark, MarketPricingResponse } from '../../utils/vehiclePricing.js';
import {
  estimateFairUsedPrice,
  findSimilarVehicles,
  getReferenceOnRoadPrice,
  type MarketPricingVehicleInput,
} from '../../utils/vehiclePricing.js';
import { fetchIndianBlueBookValuation } from '../../lib/indianBlueBook.js';
import { fetchSurepassVehicleValuation } from '../../lib/surepassVehiclePricing.js';
import {
  USE_SUPABASE,
  supabaseVehicleService,
  type HandlerOptions,
} from '../handler-shared.js';

export type { ExternalMarketBenchmark, MarketPricingResponse } from '../../utils/vehiclePricing.js';

interface CacheEntry {
  expiresAt: number;
  payload: MarketPricingResponse;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function firstQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function cacheKey(params: {
  make: string;
  model: string;
  year: number;
  mileage: number;
  city?: string;
}): string {
  const mileageBucket = Math.floor(params.mileage / 10000);
  return `v4|${params.make}|${params.model}|${params.year}|${mileageBucket}|${params.city || ''}`.toLowerCase();
}

async function fetchPlatformComparables(
  vehicle: MarketPricingVehicleInput,
): Promise<Pick<Vehicle, 'price' | 'year' | 'mileage'>[]> {
  if (!USE_SUPABASE) return [];

  const published = await supabaseVehicleService.findByStatus('published', { limit: 0 });
  return findSimilarVehicles(vehicle, published).slice(0, 30);
}

function buildEstimateBenchmark(
  vehicle: Pick<Vehicle, 'make' | 'model' | 'year' | 'mileage'> & Partial<Pick<Vehicle, 'variant'>>,
): ExternalMarketBenchmark {
  const newOnRoadPrice = getReferenceOnRoadPrice(
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.variant,
  );
  const fair = estimateFairUsedPrice(vehicle);
  return {
    newOnRoadPrice: newOnRoadPrice ?? null,
    usedFairLow: fair ? Math.round(fair * 0.88) : null,
    usedFairHigh: fair ? Math.round(fair * 1.12) : null,
    usedFairAverage: fair ?? null,
    summary: 'Estimated from current Indian used-car retention curves for this model year and mileage.',
    source: 'estimate',
    fetchedAt: new Date().toISOString(),
  };
}

export async function buildMarketPricingResponse(
  vehicle: MarketPricingVehicleInput,
): Promise<MarketPricingResponse> {
  // Public endpoint: Surepass → IBB → platform comparables → static estimate.
  // Gemini live search removed to prevent unauthenticated API-key cost abuse.
  const [comparables, surepassExternal, ibbExternal] = await Promise.all([
    fetchPlatformComparables(vehicle),
    fetchSurepassVehicleValuation(vehicle),
    fetchIndianBlueBookValuation(vehicle),
  ]);

  const external =
    surepassExternal ??
    ibbExternal ??
    (comparables.length >= 3
      ? (() => {
          const prices = comparables.map((v) => v.price).sort((a, b) => a - b);
          const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
          const low = prices[Math.floor(prices.length * 0.2)] ?? prices[0];
          const high = prices[Math.floor(prices.length * 0.8)] ?? prices[prices.length - 1];
          return {
            newOnRoadPrice: getReferenceOnRoadPrice(
              vehicle.make,
              vehicle.model,
              vehicle.year,
              vehicle.variant,
            ),
            usedFairLow: Math.round(low),
            usedFairHigh: Math.round(high),
            usedFairAverage: Math.round(avg),
            summary: `Based on ${comparables.length} similar live listings on ReRide.`,
            source: 'platform' as const,
            fetchedAt: new Date().toISOString(),
          };
        })()
      : buildEstimateBenchmark(vehicle));

  return {
    success: true,
    comparables,
    comparableCount: comparables.length,
    external,
    cached: false,
  };
}

export async function handleVehiclePricing(
  req: VercelRequest,
  res: VercelResponse,
  _options: HandlerOptions,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  const make = firstQueryParam(req.query?.make)?.trim();
  const model = firstQueryParam(req.query?.model)?.trim();
  const yearRaw = firstQueryParam(req.query?.year);
  const mileageRaw = firstQueryParam(req.query?.mileage);
  const priceRaw = firstQueryParam(req.query?.price);
  const idRaw = firstQueryParam(req.query?.id);
  const city = firstQueryParam(req.query?.city)?.trim();
  const state = firstQueryParam(req.query?.state)?.trim();
  const fuelType = firstQueryParam(req.query?.fuelType)?.trim();
  const transmission = firstQueryParam(req.query?.transmission)?.trim();
  const variant = firstQueryParam(req.query?.variant)?.trim();
  const ownersRaw = firstQueryParam(req.query?.noOfOwners);
  const registrationNumber = firstQueryParam(req.query?.registrationNumber)?.trim();
  const color = firstQueryParam(req.query?.color)?.trim();

  const year = yearRaw ? parseInt(yearRaw, 10) : NaN;
  const mileage = mileageRaw ? parseInt(mileageRaw, 10) : 0;
  const price = priceRaw ? parseInt(priceRaw, 10) : 0;
  const id = idRaw ? parseInt(idRaw, 10) : 0;
  const noOfOwners = ownersRaw ? parseInt(ownersRaw, 10) : undefined;

  if (!make || !model || !Number.isFinite(year) || year < 1990) {
    return res.status(400).json({
      success: false,
      reason: 'Query params make, model, and year are required',
    });
  }

  const vehicle: MarketPricingVehicleInput = {
    id: Number.isFinite(id) ? id : 0,
    make,
    model,
    variant,
    year,
    mileage: Number.isFinite(mileage) ? mileage : 0,
    price: Number.isFinite(price) ? price : 0,
    status: 'published',
    city,
    state,
    fuelType,
    transmission,
    noOfOwners: Number.isFinite(noOfOwners) ? noOfOwners : undefined,
    registrationNumber,
    color,
  };

  const key = cacheKey({ make, model, year, mileage: vehicle.mileage, city });
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json({ ...cached.payload, cached: true });
  }

  try {
    const payload = await buildMarketPricingResponse(vehicle);
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return res.status(200).json(payload);
  } catch (error) {
    const fallback = buildEstimateBenchmark(vehicle);
    return res.status(200).json({
      success: true,
      comparables: [],
      comparableCount: 0,
      external: fallback,
      cached: false,
      reason: error instanceof Error ? error.message : 'Market pricing fetch failed',
    });
  }
}
