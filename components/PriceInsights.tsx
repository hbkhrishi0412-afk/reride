/**
 * Price Insights Component
 * Shows price fairness analysis, market comparison, and value indicators for buyers.
 * Public badges only show positive/neutral deal ratings (Great/Good/Fair) — never "Overpriced".
 */

import React, { useState, useMemo, useEffect } from 'react';
import type { Vehicle } from '../types';
import {
  analyzeVehiclePricing,
  formatIndianPrice,
  type BuyerVisibleDealLabel,
  type DealRatingLabel,
  type ExternalMarketInput,
} from '../utils/vehiclePricing';
import { fetchLiveMarketPricing } from '../services/vehicleMarketPricingService';

const IBB_PUBLIC_VALUATION_URL = 'https://www.indianbluebook.com/';

interface PriceInsightsProps {
  vehicle: Vehicle;
  similarVehicles?: Pick<Vehicle, 'price' | 'year' | 'mileage'>[];
  compact?: boolean;
  /** Hide price row in compact mode when price is already shown elsewhere. */
  compactHidePrice?: boolean;
  /** Navigate to full price tab instead of expanding inline. */
  onViewFullAnalysis?: () => void;
  /** When true (default), hide negative public badges and overpriced meter labels. */
  buyerFacing?: boolean;
}

interface ValueFactor {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

function buildValueFactors(vehicle: Vehicle): ValueFactor[] {
  const currentYear = new Date().getFullYear();
  const ageYears = currentYear - vehicle.year;
  const expectedMileage = ageYears * 12000;
  const factors: ValueFactor[] = [];

  if (mileageFactor(vehicle.mileage, expectedMileage)) {
    factors.push(mileageFactor(vehicle.mileage, expectedMileage)!);
  }

  if (vehicle.noOfOwners === 1) {
    factors.push({
      label: 'Single Owner',
      impact: 'positive',
      detail: 'First owner vehicles typically command premium',
    });
  } else if (vehicle.noOfOwners && vehicle.noOfOwners >= 3) {
    factors.push({
      label: 'Multiple Owners',
      impact: 'negative',
      detail: 'Multiple ownership may indicate issues',
    });
  }

  if (vehicle.serviceRecords && vehicle.serviceRecords.length > 0) {
    factors.push({
      label: 'Service History',
      impact: 'positive',
      detail: 'Documented maintenance records available',
    });
  }

  if (vehicle.insuranceType === 'Comprehensive') {
    factors.push({
      label: 'Comprehensive Insurance',
      impact: 'positive',
      detail: 'Full coverage indicates well-maintained vehicle',
    });
  }

  if (vehicle.certifiedInspection) {
    factors.push({
      label: 'Photo Check Available',
      impact: 'positive',
      detail: 'Seller-submitted photos reviewed — verify in person before buying',
    });
  }

  return factors;
}

function mileageFactor(mileage: number, expectedMileage: number): ValueFactor | null {
  if (expectedMileage <= 0) {
    return {
      label: 'Average Mileage',
      impact: 'neutral',
      detail: 'Within expected range for vehicle age',
    };
  }
  if (mileage < expectedMileage * 0.7) {
    return {
      label: 'Low Mileage',
      impact: 'positive',
      detail: `${Math.round(((expectedMileage - mileage) / expectedMileage) * 100)}% below average for age`,
    };
  }
  if (mileage > expectedMileage * 1.3) {
    return {
      label: 'High Mileage',
      impact: 'negative',
      detail: `${Math.round(((mileage - expectedMileage) / expectedMileage) * 100)}% above average for age`,
    };
  }
  return {
    label: 'Average Mileage',
    impact: 'neutral',
    detail: 'Within expected range for vehicle age',
  };
}

function getFairnessColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#84cc16';
  if (score >= 50) return '#eab308';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}

const PriceMeter: React.FC<{
  price: number;
  marketLow: number;
  marketHigh: number;
  marketAverage: number;
  buyerFacing?: boolean;
}> = ({ price, marketLow, marketHigh, marketAverage, buyerFacing = true }) => {
  const range = marketHigh - marketLow;
  const extendedLow = marketLow - range * 0.2;
  const extendedHigh = marketHigh + range * 0.2;
  const totalRange = extendedHigh - extendedLow;

  const pricePosition = Math.min(100, Math.max(0, ((price - extendedLow) / totalRange) * 100));
  const avgPosition = ((marketAverage - extendedLow) / totalRange) * 100;
  const lowPosition = ((marketLow - extendedLow) / totalRange) * 100;
  const highPosition = ((marketHigh - extendedLow) / totalRange) * 100;

  return (
    <div className="relative mt-4 mb-6">
      <div className="h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 relative">
        <div
          className="absolute h-full bg-blue-200/50 rounded-full"
          style={{ left: `${lowPosition}%`, width: `${highPosition - lowPosition}%` }}
        />
        <div
          className="absolute w-0.5 h-5 bg-blue-600 -top-1"
          style={{ left: `${avgPosition}%` }}
          title={`Market Average: ${formatIndianPrice(marketAverage)}`}
        />
        <div
          className="absolute w-4 h-4 bg-white border-4 border-reride-orange rounded-full -top-0.5 transform -translate-x-1/2 shadow-lg"
          style={{ left: `${pricePosition}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Great Deal</span>
        <span className="text-blue-600 font-medium">Market Avg</span>
        <span>{buyerFacing ? 'Higher' : 'Overpriced'}</span>
      </div>
    </div>
  );
};

export const PriceFairnessBadge: React.FC<{
  fairnessLabel: DealRatingLabel | BuyerVisibleDealLabel;
  priceDifferencePercent?: number;
  buyerFacing?: boolean;
}> = ({ fairnessLabel, priceDifferencePercent = 0, buyerFacing = true }) => {
  if (buyerFacing && (fairnessLabel === 'Above Market' || fairnessLabel === 'Overpriced')) {
    return null;
  }

  const colors: Record<string, string> = {
    'Great Deal': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Good Price': 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
    'Fair Price': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'Above Market': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    Overpriced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[fairnessLabel] || ''}`}>
      {fairnessLabel}
      {priceDifferencePercent !== 0 && fairnessLabel !== 'Fair Price' && (
        <span className="ml-1 opacity-75">
          ({priceDifferencePercent > 0 ? '+' : ''}
          {priceDifferencePercent}%)
        </span>
      )}
    </span>
  );
};

export const PriceInsights: React.FC<PriceInsightsProps> = ({
  vehicle,
  similarVehicles = [],
  compact = false,
  compactHidePrice = false,
  onViewFullAnalysis,
  buyerFacing = true,
}) => {
  const [showDetails, setShowDetails] = useState(!compact);
  const [liveMarket, setLiveMarket] = useState<ExternalMarketInput | null>(null);
  const [liveComparables, setLiveComparables] = useState(similarVehicles);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketSummary, setMarketSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);

    fetchLiveMarketPricing(vehicle)
      .then((response) => {
        if (cancelled || !response) return;
        setLiveComparables(
          response.comparables.length > 0 ? response.comparables : similarVehicles,
        );
        setLiveMarket({
          newOnRoadPrice: response.external.newOnRoadPrice,
          usedFairLow: response.external.usedFairLow,
          usedFairHigh: response.external.usedFairHigh,
          usedFairAverage: response.external.usedFairAverage,
          source: response.external.source,
          fetchedAt: response.external.fetchedAt,
        });
        setMarketSummary(response.external.summary);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    vehicle.id,
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.mileage,
    vehicle.price,
    vehicle.city,
    vehicle.state,
  ]);

  const analysis = useMemo(
    () => analyzeVehiclePricing(vehicle, liveComparables, liveMarket ?? undefined),
    [vehicle, liveComparables, liveMarket],
  );
  const valueFactors = useMemo(() => buildValueFactors(vehicle), [vehicle]);
  const displayLabel = buyerFacing
    ? analysis.buyerVisibleLabel
    : analysis.fairnessLabel;

  const dataSourceLabel =
    analysis.dataSource === 'surepass'
      ? 'Surepass (IDV & market value)'
      : analysis.dataSource === 'ibb'
        ? 'Indian Blue Book (IBB)'
        : analysis.dataSource === 'live_search'
          ? 'live Indian market data'
          : analysis.dataSource === 'platform'
            ? 'live ReRide listings'
            : analysis.dataSource === 'estimate'
              ? 'IBB-style estimates'
              : 'market data';

  if (compact) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            {!compactHidePrice && (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatIndianPrice(vehicle.price)}
              </p>
            )}
            {displayLabel && (
              <PriceFairnessBadge
                fairnessLabel={displayLabel}
                priceDifferencePercent={analysis.priceDifferencePercent}
                buyerFacing={buyerFacing}
              />
            )}
          </div>
          {displayLabel && (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: getFairnessColor(analysis.fairnessScore) }}
            >
              {analysis.fairnessScore}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => (onViewFullAnalysis ? onViewFullAnalysis() : setShowDetails(true))}
          className="mt-3 text-sm text-reride-orange hover:underline"
        >
          View price analysis →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span>💰</span> Price Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {marketLoading
                ? 'Fetching live market pricing…'
                : `Based on ${liveComparables.length || 'market'} similar listings and ${dataSourceLabel}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatIndianPrice(vehicle.price)}
            </p>
            {displayLabel && (
              <PriceFairnessBadge
                fairnessLabel={displayLabel}
                priceDifferencePercent={analysis.priceDifferencePercent}
                buyerFacing={buyerFacing}
              />
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {marketSummary && !marketLoading && (
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            {marketSummary}
          </p>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Price Position in Market
          </p>
          <PriceMeter
            price={vehicle.price}
            marketLow={analysis.marketLow}
            marketHigh={analysis.marketHigh}
            marketAverage={analysis.marketAverage}
            buyerFacing={buyerFacing}
          />
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Market Low</p>
              <p className="font-semibold text-green-600">{formatIndianPrice(analysis.marketLow)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Average</p>
              <p className="font-semibold text-blue-600">{formatIndianPrice(analysis.marketAverage)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Market High</p>
              <p className="font-semibold text-red-600">{formatIndianPrice(analysis.marketHigh)}</p>
            </div>
          </div>
        </div>

        {displayLabel && (
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg"
              style={{ backgroundColor: getFairnessColor(analysis.fairnessScore) }}
            >
              {analysis.fairnessScore}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white text-lg">{displayLabel}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {analysis.priceDifferencePercent < 0
                  ? `${Math.abs(analysis.priceDifferencePercent)}% below market average`
                  : analysis.priceDifferencePercent > 0
                    ? `${analysis.priceDifferencePercent}% above market average`
                    : 'At market average price'}
              </p>
            </div>
          </div>
        )}

        {!displayLabel && buyerFacing && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {analysis.fairUsedPrice && vehicle.price > analysis.fairUsedPrice * 1.25
              ? `This price is well above what a ${vehicle.year} ${vehicle.make} ${vehicle.model} typically sells for (${formatIndianPrice(analysis.fairUsedPrice)} estimated). Compare carefully before buying.`
              : 'Compare with similar listings below and negotiate based on condition and documents.'}
          </p>
        )}

        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Value Factors</h4>
          <div className="space-y-2">
            {valueFactors.map((factor, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <span className="text-lg">
                  {factor.impact === 'positive' ? '✅' : factor.impact === 'negative' ? '⚠️' : '➖'}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{factor.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{factor.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {buyerFacing && (
          <p className="text-sm font-semibold text-center text-orange-700 dark:text-orange-300 px-2">
            {displayLabel === 'Great Deal' || displayLabel === 'Good Price'
              ? 'Priced below market — enquire today before it\u2019s gone.'
              : 'If this fits, enquire today — good listings move fast.'}
          </p>
        )}

        <p className="text-xs text-gray-500 text-center">
          Price analysis uses Indian Blue Book–aligned benchmarks and comparable listings. Always inspect the vehicle and verify documents before paying.
        </p>
        {analysis.dataSource !== 'surepass' && analysis.dataSource !== 'ibb' && !marketLoading && (
          <p className="text-xs text-center">
            <a
              href={IBB_PUBLIC_VALUATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-reride-orange hover:underline font-medium"
            >
              Verify fair price on Indian Blue Book →
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

export default PriceInsights;
