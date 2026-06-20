import type { Vehicle } from '../types.js';

/** Minimal vehicle fields for platform comparable search and market pricing APIs. */
export type ComparableVehiclePick = Pick<
  Vehicle,
  'id' | 'make' | 'model' | 'year' | 'mileage' | 'price' | 'status'
> & Partial<Pick<Vehicle, 'city'>>;

export type MarketPricingVehicleInput = ComparableVehiclePick &
  Partial<
    Pick<
      Vehicle,
      'variant' | 'state' | 'fuelType' | 'transmission' | 'noOfOwners' | 'registrationNumber' | 'color'
    >
  >;

export type DealRatingLabel = 'Great Deal' | 'Good Price' | 'Fair Price' | 'Above Market' | 'Overpriced';

/** Buyer-visible labels only — never show negative badges on public listings. */
export type BuyerVisibleDealLabel = 'Great Deal' | 'Good Price' | 'Fair Price';

export interface PriceAnalysis {
  fairnessScore: number;
  fairnessLabel: DealRatingLabel;
  buyerVisibleLabel: BuyerVisibleDealLabel | null;
  marketLow: number;
  marketHigh: number;
  marketAverage: number;
  priceDifferencePercent: number;
  priceDifferenceAmount: number;
  competitorCount: number;
  /** Expected used value from age/mileage depreciation (when model reference exists). */
  fairUsedPrice?: number;
  /** Approximate new on-road price for this model (when known). */
  referenceOnRoadPrice?: number;
  /** Where benchmark data came from. */
  dataSource?: 'surepass' | 'ibb' | 'live_search' | 'platform' | 'estimate' | 'local';
  dataFetchedAt?: string;
}

export interface ExternalMarketInput {
  newOnRoadPrice?: number | null;
  usedFairLow?: number | null;
  usedFairHigh?: number | null;
  usedFairAverage?: number | null;
  source?: 'surepass' | 'ibb' | 'live_search' | 'platform' | 'estimate';
  fetchedAt?: string;
}

export interface ExternalMarketBenchmark {
  newOnRoadPrice: number | null;
  usedFairLow: number | null;
  usedFairHigh: number | null;
  usedFairAverage: number | null;
  summary: string;
  source: 'surepass' | 'ibb' | 'live_search' | 'platform' | 'estimate';
  fetchedAt: string;
}

export interface MarketPricingResponse {
  success: boolean;
  comparables: Pick<Vehicle, 'price' | 'year' | 'mileage'>[];
  comparableCount: number;
  external: ExternalMarketBenchmark;
  cached: boolean;
  reason?: string;
}

/** Age-based value retention (% of on-road) — calibrated to Indian used-car market. */
function retentionForAge(yearsOld: number): number {
  const table: Record<number, number> = {
    0: 0.9,
    1: 0.84,
    2: 0.78,
    3: 0.72,
    4: 0.66,
    5: 0.61,
    6: 0.56,
    7: 0.51,
    8: 0.46,
  };
  if (yearsOld <= 8) return table[yearsOld] ?? 0.9;
  return Math.max(0.2, 0.46 - (yearsOld - 8) * 0.04);
}

/** Year-specific on-road overrides for models with major generational price shifts. */
const REFERENCE_ON_ROAD_BY_YEAR: Record<string, Record<number, number>> = {
  'hyundai_verna': { 2023: 1680000, 2024: 1720000, 2025: 1750000, 2026: 1750000 },
  'hyundai_creta': { 2024: 1750000, 2025: 1800000, 2026: 1800000 },
  'hyundai_exter': { 2023: 1100000, 2024: 1150000, 2025: 1180000 },
};

const DEPRECIATION_PER_10K_KM = 0.012;
const LOW_MILEAGE_BONUS_CAP = 0.06;

/** Approximate on-road prices (INR) for popular Indian models — used as sanity anchor. */
const REFERENCE_ON_ROAD: Record<string, number> = {
  'maruti suzuki_swift': 850000,
  'maruti suzuki_baleno': 950000,
  'maruti suzuki_brezza': 1250000,
  'maruti suzuki_ertiga': 1300000,
  'maruti suzuki_fronx': 1150000,
  'maruti suzuki_grand vitara': 1750000,
  'maruti suzuki_invicto': 2800000,
  'hyundai_creta': 1650000,
  'hyundai_venue': 1150000,
  'hyundai_i20': 950000,
  'hyundai_verna': 1580000,
  'hyundai_exter': 1050000,
  'hyundai_alcazar': 2100000,
  'tata_nexon': 1250000,
  'tata_nexon ev': 1650000,
  'tata_punch': 1050000,
  'tata_harrier': 2250000,
  'tata_safari': 2350000,
  'tata_altroz': 950000,
  'tata_tiago': 750000,
  'mahindra_xuv700': 2250000,
  'mahindra_scorpio-n': 1750000,
  'mahindra_thar': 1650000,
  'mahindra_xuv300': 1250000,
  'mahindra_xuv 3xo': 1150000,
  'kia_seltos': 1750000,
  'kia_sonet': 1250000,
  'kia_carens': 1650000,
  'honda_city': 1450000,
  'honda_amaze': 950000,
  'honda_elevate': 1650000,
  'toyota_fortuner': 4200000,
  'toyota_innova crysta': 2250000,
  'toyota_innova hycross': 2800000,
  'toyota_glanza': 1050000,
  'toyota_urban cruiser hyryder': 1650000,
  'nissan_magnite': 950000,
  'nissan_kicks': 1150000,
  'renault_kiger': 1050000,
  'renault_kwid': 550000,
  'renault_triber': 950000,
  'mg_hector': 1750000,
  'mg_astor': 1450000,
  'mg_gloster': 4200000,
  'volkswagen_taigun': 1450000,
  'volkswagen_virtus': 1550000,
  'skoda_kushaq': 1450000,
  'skoda_slavia': 1550000,
  'jeep_compass': 3200000,
  'citroen_c3': 850000,
  'citroen_c3 aircross': 1250000,
};

export function formatIndianPrice(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} Lakh`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function lookupKey(make: string, model: string): string {
  return `${make.toLowerCase().trim()}_${model.toLowerCase().trim()}`;
}

export function getReferenceOnRoadPrice(make: string, model: string, year?: number): number | null {
  const key = lookupKey(make, model);
  const yearTable = REFERENCE_ON_ROAD_BY_YEAR[key];
  if (year && yearTable) {
    const years = Object.keys(yearTable)
      .map(Number)
      .sort((a, b) => b - a);
    for (const y of years) {
      if (year >= y) return yearTable[y];
    }
  }

  if (REFERENCE_ON_ROAD[key]) return REFERENCE_ON_ROAD[key];

  const compactModel = model.toLowerCase().trim().replace(/\s+/g, '');
  const compactKey = `${make.toLowerCase().trim()}_${compactModel}`;
  if (REFERENCE_ON_ROAD[compactKey]) return REFERENCE_ON_ROAD[compactKey];

  for (const [dbKey, onRoad] of Object.entries(REFERENCE_ON_ROAD)) {
    const [dbMake, dbModel] = dbKey.split('_');
    const normalizedMake = make.toLowerCase().trim();
    const normalizedModel = model.toLowerCase().trim();
    if (
      (normalizedMake.includes(dbMake) || dbMake.includes(normalizedMake)) &&
      (normalizedModel.includes(dbModel) || dbModel.includes(normalizedModel))
    ) {
      return onRoad;
    }
  }

  return null;
}

export function estimateFairUsedPrice(
  vehicle: Pick<Vehicle, 'make' | 'model' | 'year' | 'mileage'>,
): number | null {
  const onRoad = getReferenceOnRoadPrice(vehicle.make, vehicle.model, vehicle.year);
  if (!onRoad) return null;

  const yearsOld = Math.max(0, new Date().getFullYear() - vehicle.year);
  const ageFactor = retentionForAge(yearsOld);

  const expectedMileage = Math.max(12000, yearsOld * 12000);
  const mileageRatio = vehicle.mileage / expectedMileage;
  let kmFactor = 1;
  if (mileageRatio > 1.3) {
    kmFactor = Math.max(0.82, 1 - (mileageRatio - 1) * 0.08);
  } else if (mileageRatio < 0.75) {
    kmFactor = Math.min(1 + LOW_MILEAGE_BONUS_CAP, 1 + (0.75 - mileageRatio) * 0.12);
  } else {
    kmFactor = Math.max(0.92, 1 - (vehicle.mileage / 10000) * DEPRECIATION_PER_10K_KM);
  }

  return Math.round(onRoad * Math.max(0.22, ageFactor * kmFactor));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function filterOutlierPrices(prices: number[], ceiling?: number): number[] {
  let filtered = prices.filter((p) => p > 0);
  if (ceiling) filtered = filtered.filter((p) => p <= ceiling);
  if (filtered.length < 3) return filtered;

  const sorted = [...filtered].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const iqrFiltered = filtered.filter((p) => p >= lo && p <= hi);
  return iqrFiltered.length >= 3 ? iqrFiltered : filtered;
}

function marketStatsFromPrices(prices: number[]): { marketLow: number; marketHigh: number; marketAverage: number } {
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    marketLow: percentile(sorted, 0.2),
    marketHigh: percentile(sorted, 0.8),
    marketAverage: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

function saneComparablePrices(
  prices: number[],
  fairUsedPrice?: number,
  referenceOnRoad?: number,
): number[] {
  if (prices.length === 0) return prices;
  const lo = fairUsedPrice ? fairUsedPrice * 0.65 : 0;
  const hi = referenceOnRoad ? referenceOnRoad * 1.08 : Infinity;
  const sane = prices.filter((p) => p >= lo && p <= hi);
  return sane.length >= 3 ? sane : prices.filter((p) => p > 0 && (!referenceOnRoad || p <= referenceOnRoad * 1.15));
}

function computeBenchmarkAverage(
  marketAverage: number,
  filteredPrices: number[],
  fairUsedPrice?: number,
  referenceOnRoad?: number,
): number {
  const sane = saneComparablePrices(filteredPrices, fairUsedPrice, referenceOnRoad);
  if (sane.length >= 3) {
    const sorted = [...sane].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    if (fairUsedPrice) {
      return Math.round(Math.max(fairUsedPrice * 0.92, Math.min(median, fairUsedPrice * 1.2)));
    }
    return Math.round(median);
  }
  if (fairUsedPrice) return fairUsedPrice;
  return marketAverage;
}

function fairValueRange(fairUsedPrice: number): { marketLow: number; marketHigh: number; marketAverage: number } {
  return {
    marketLow: fairUsedPrice * 0.85,
    marketHigh: fairUsedPrice * 1.15,
    marketAverage: fairUsedPrice,
  };
}

function scoreFromPercentDiff(priceDifferencePercent: number): {
  fairnessScore: number;
  fairnessLabel: DealRatingLabel;
  buyerVisibleLabel: BuyerVisibleDealLabel | null;
} {
  let fairnessScore: number;
  if (priceDifferencePercent <= -15) fairnessScore = 95;
  else if (priceDifferencePercent <= -10) fairnessScore = 85;
  else if (priceDifferencePercent <= -5) fairnessScore = 75;
  else if (priceDifferencePercent <= 0) fairnessScore = 65;
  else if (priceDifferencePercent <= 5) fairnessScore = 55;
  else if (priceDifferencePercent <= 10) fairnessScore = 45;
  else if (priceDifferencePercent <= 15) fairnessScore = 35;
  else fairnessScore = 20;

  let fairnessLabel: DealRatingLabel;
  if (fairnessScore >= 80) fairnessLabel = 'Great Deal';
  else if (fairnessScore >= 65) fairnessLabel = 'Good Price';
  else if (fairnessScore >= 50) fairnessLabel = 'Fair Price';
  else if (fairnessScore >= 35) fairnessLabel = 'Above Market';
  else fairnessLabel = 'Overpriced';

  const buyerVisibleLabel: BuyerVisibleDealLabel | null =
    fairnessLabel === 'Great Deal' || fairnessLabel === 'Good Price' || fairnessLabel === 'Fair Price'
      ? fairnessLabel
      : null;

  return { fairnessScore, fairnessLabel, buyerVisibleLabel };
}

/**
 * Compare a listing to similar vehicles (same make/model, ±2 years, ±30% mileage when possible).
 */
export function findSimilarVehicles(
  vehicle: Pick<Vehicle, 'id' | 'make' | 'model' | 'year' | 'mileage'>,
  pool: ComparableVehiclePick[],
): Pick<Vehicle, 'price' | 'year' | 'mileage'>[] {
  const mileageLo = vehicle.mileage * 0.7;
  const mileageHi = vehicle.mileage * 1.3;
  return pool.filter((v) => {
    if (v.id === vehicle.id) return false;
    if (v.status && v.status !== 'published') return false;
    if (v.make !== vehicle.make || v.model !== vehicle.model) return false;
    if (Math.abs(v.year - vehicle.year) > 2) return false;
    if (v.mileage < mileageLo || v.mileage > mileageHi) return false;
    return v.price > 0;
  });
}

export function analyzeVehiclePricing(
  vehicle: Vehicle,
  similarVehicles: Pick<Vehicle, 'price' | 'year' | 'mileage'>[],
  externalMarket?: ExternalMarketInput,
): PriceAnalysis {
  const analysis = analyzeVehiclePricingInternal(vehicle, similarVehicles, externalMarket);

  if (externalMarket?.source) {
    analysis.dataSource = externalMarket.source;
    analysis.dataFetchedAt = externalMarket.fetchedAt;
  } else {
    analysis.dataSource = 'local';
  }

  return analysis;
}

function analyzeVehiclePricingInternal(
  vehicle: Vehicle,
  similarVehicles: Pick<Vehicle, 'price' | 'year' | 'mileage'>[],
  externalMarket?: ExternalMarketInput,
): PriceAnalysis {
  const { price } = vehicle;
  const competitorCount = similarVehicles.length;
  const referenceOnRoadPrice =
    externalMarket?.newOnRoadPrice ??
    getReferenceOnRoadPrice(vehicle.make, vehicle.model, vehicle.year) ??
    undefined;
  const fairUsedPrice =
    externalMarket?.usedFairAverage ??
    estimateFairUsedPrice(vehicle) ??
    undefined;

  const priceCeiling =
    referenceOnRoadPrice ??
    (fairUsedPrice ? Math.round(fairUsedPrice * 2) : undefined);

  const filteredPrices = filterOutlierPrices(
    similarVehicles.map((v) => v.price),
    priceCeiling,
  );

  let marketLow: number;
  let marketHigh: number;
  let marketAverage: number;

  if (filteredPrices.length >= 3) {
    ({ marketLow, marketHigh, marketAverage } = marketStatsFromPrices(filteredPrices));
  } else if (externalMarket?.usedFairLow && externalMarket.usedFairHigh && externalMarket.usedFairAverage) {
    marketLow = externalMarket.usedFairLow;
    marketHigh = externalMarket.usedFairHigh;
    marketAverage = externalMarket.usedFairAverage;
  } else if (fairUsedPrice) {
    ({ marketLow, marketHigh, marketAverage } = fairValueRange(fairUsedPrice));
  } else {
    const currentYear = new Date().getFullYear();
    const ageYears = Math.max(0, currentYear - vehicle.year);
    marketAverage = price * (1 + Math.min(ageYears * 0.02, 0.1));
    marketLow = marketAverage * 0.85;
    marketHigh = marketAverage * 1.15;
  }

  // Anchor against realistic depreciation — prevents "good price" when every listing is inflated.
  const benchmarkAverage = computeBenchmarkAverage(
    marketAverage,
    filteredPrices,
    fairUsedPrice,
    referenceOnRoadPrice,
  );

  if (referenceOnRoadPrice && price >= referenceOnRoadPrice * 0.95) {
    const { fairnessScore, fairnessLabel, buyerVisibleLabel } = scoreFromPercentDiff(25);
    const range = fairUsedPrice ? fairValueRange(fairUsedPrice) : { marketLow, marketHigh, marketAverage: benchmarkAverage };
    return {
      fairnessScore,
      fairnessLabel,
      buyerVisibleLabel,
      marketLow: Math.round(range.marketLow),
      marketHigh: Math.round(range.marketHigh),
      marketAverage: Math.round(range.marketAverage),
      priceDifferencePercent: Math.round(((price - benchmarkAverage) / benchmarkAverage) * 100),
      priceDifferenceAmount: Math.round(price - benchmarkAverage),
      competitorCount,
      fairUsedPrice,
      referenceOnRoadPrice,
    };
  }

  if (fairUsedPrice && price > fairUsedPrice * 1.25) {
    const { fairnessScore, fairnessLabel, buyerVisibleLabel } = scoreFromPercentDiff(
      Math.round(((price - benchmarkAverage) / benchmarkAverage) * 100),
    );
    const range = fairValueRange(fairUsedPrice);
    return {
      fairnessScore: Math.min(fairnessScore, 35),
      fairnessLabel: price > fairUsedPrice * 1.5 ? 'Overpriced' : fairnessLabel,
      buyerVisibleLabel: null,
      marketLow: Math.round(range.marketLow),
      marketHigh: Math.round(range.marketHigh),
      marketAverage: Math.round(range.marketAverage),
      priceDifferencePercent: Math.round(((price - benchmarkAverage) / benchmarkAverage) * 100),
      priceDifferenceAmount: Math.round(price - benchmarkAverage),
      competitorCount,
      fairUsedPrice,
      referenceOnRoadPrice,
    };
  }

  const priceDifferenceAmount = price - benchmarkAverage;
  const priceDifferencePercent =
    benchmarkAverage > 0 ? Math.round(((price - benchmarkAverage) / benchmarkAverage) * 100) : 0;

  const { fairnessScore, fairnessLabel, buyerVisibleLabel } = scoreFromPercentDiff(priceDifferencePercent);

  return {
    fairnessScore,
    fairnessLabel,
    buyerVisibleLabel,
    marketLow: Math.round(marketLow),
    marketHigh: Math.round(marketHigh),
    marketAverage: Math.round(benchmarkAverage),
    priceDifferencePercent,
    priceDifferenceAmount: Math.round(priceDifferenceAmount),
    competitorCount,
    fairUsedPrice,
    referenceOnRoadPrice,
  };
}

export interface SellerPricingHint {
  headline: string;
  detail: string;
  suggestedPrice?: number;
  lowerByAmount?: number;
}

/** Private seller-dashboard copy — opportunity framing, not public shaming. */
export function buildSellerPricingHint(
  vehicle: Vehicle,
  analysis: PriceAnalysis,
): SellerPricingHint | null {
  if (analysis.competitorCount < 2 && !analysis.fairUsedPrice) {
    return {
      headline: 'Not enough similar listings yet',
      detail: 'Add more photos and details — we will show market guidance once comparable cars are listed.',
    };
  }

  if (analysis.fairUsedPrice && vehicle.price > analysis.fairUsedPrice * 1.25) {
    const suggested = Math.max(0, Math.round(analysis.fairUsedPrice * 1.05 / 5000) * 5000);
    return {
      headline: 'Price looks high for this model',
      detail: `Based on age and mileage, cars like this typically sell around ${formatIndianPrice(analysis.fairUsedPrice)}. Consider adjusting to attract more buyers.`,
      suggestedPrice: suggested,
      lowerByAmount: Math.max(10000, vehicle.price - suggested),
    };
  }

  if (analysis.priceDifferencePercent > 5) {
    const lowerBy = Math.max(10000, Math.round(analysis.priceDifferenceAmount * 0.6 / 5000) * 5000);
    const suggested = Math.max(0, vehicle.price - lowerBy);
    return {
      headline: `${analysis.competitorCount} similar cars are priced lower`,
      detail: `Cars like yours typically sell for ${formatIndianPrice(analysis.marketLow)}–${formatIndianPrice(analysis.marketHigh)}. A small price adjustment can bring more enquiries.`,
      suggestedPrice: suggested,
      lowerByAmount: lowerBy,
    };
  }

  if (analysis.buyerVisibleLabel === 'Great Deal' || analysis.buyerVisibleLabel === 'Good Price') {
    return {
      headline: 'Competitively priced',
      detail: `Your price is in the ${analysis.buyerVisibleLabel.toLowerCase()} range. Buyers may see a deal badge on your listing.`,
    };
  }

  return {
    headline: 'Fair market price',
    detail: `Similar listings range ${formatIndianPrice(analysis.marketLow)}–${formatIndianPrice(analysis.marketHigh)}. Your price is aligned with the market.`,
  };
}
