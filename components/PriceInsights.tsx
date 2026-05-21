/**
 * Price Insights Component
 * Shows price fairness analysis, market comparison, and value indicators for buyers
 */

import React, { useState, useMemo } from 'react';
import type { Vehicle } from '../types';

interface PriceInsightsProps {
  vehicle: Vehicle;
  similarVehicles?: Pick<Vehicle, 'price' | 'year' | 'mileage'>[];
  compact?: boolean;
}

interface PriceAnalysis {
  fairnessScore: number; // 0-100
  fairnessLabel: 'Great Deal' | 'Good Price' | 'Fair Price' | 'Above Market' | 'Overpriced';
  marketLow: number;
  marketHigh: number;
  marketAverage: number;
  priceDifferencePercent: number;
  priceDifferenceAmount: number;
  depreciationEstimate: number;
  valueFactors: { label: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[];
}

/**
 * Calculate price analysis based on vehicle and market data
 */
function analyzePricing(
  vehicle: Vehicle,
  similarVehicles: Pick<Vehicle, 'price' | 'year' | 'mileage'>[]
): PriceAnalysis {
  const { price, year, mileage } = vehicle;
  const currentYear = new Date().getFullYear();
  const ageYears = currentYear - year;

  // If no similar vehicles, estimate based on typical depreciation
  let marketLow: number, marketHigh: number, marketAverage: number;
  
  if (similarVehicles.length >= 3) {
    const prices = similarVehicles.map(v => v.price).sort((a, b) => a - b);
    marketLow = prices[Math.floor(prices.length * 0.2)]; // 20th percentile
    marketHigh = prices[Math.floor(prices.length * 0.8)]; // 80th percentile
    marketAverage = prices.reduce((a, b) => a + b, 0) / prices.length;
  } else {
    // Estimate based on typical used car pricing
    const baseNewPrice = price / (1 - ageYears * 0.08); // Reverse depreciation estimate
    marketAverage = price * 1.05; // Assume listed price is slightly below average
    marketLow = marketAverage * 0.85;
    marketHigh = marketAverage * 1.15;
  }

  // Calculate price difference from market average
  const priceDifferenceAmount = price - marketAverage;
  const priceDifferencePercent = ((price - marketAverage) / marketAverage) * 100;

  // Calculate fairness score (100 = great deal, 0 = very overpriced)
  let fairnessScore: number;
  if (priceDifferencePercent <= -15) fairnessScore = 95;
  else if (priceDifferencePercent <= -10) fairnessScore = 85;
  else if (priceDifferencePercent <= -5) fairnessScore = 75;
  else if (priceDifferencePercent <= 0) fairnessScore = 65;
  else if (priceDifferencePercent <= 5) fairnessScore = 55;
  else if (priceDifferencePercent <= 10) fairnessScore = 45;
  else if (priceDifferencePercent <= 15) fairnessScore = 35;
  else fairnessScore = 20;

  // Determine fairness label
  let fairnessLabel: PriceAnalysis['fairnessLabel'];
  if (fairnessScore >= 80) fairnessLabel = 'Great Deal';
  else if (fairnessScore >= 65) fairnessLabel = 'Good Price';
  else if (fairnessScore >= 50) fairnessLabel = 'Fair Price';
  else if (fairnessScore >= 35) fairnessLabel = 'Above Market';
  else fairnessLabel = 'Overpriced';

  // Estimate future depreciation (next year)
  const depreciationRate = ageYears < 3 ? 0.12 : ageYears < 5 ? 0.08 : 0.05;
  const depreciationEstimate = Math.round(price * depreciationRate);

  // Value factors analysis
  const valueFactors: PriceAnalysis['valueFactors'] = [];

  // Mileage factor
  const expectedMileage = ageYears * 12000; // Average 12k km/year
  if (mileage < expectedMileage * 0.7) {
    valueFactors.push({
      label: 'Low Mileage',
      impact: 'positive',
      detail: `${Math.round(((expectedMileage - mileage) / expectedMileage) * 100)}% below average for age`,
    });
  } else if (mileage > expectedMileage * 1.3) {
    valueFactors.push({
      label: 'High Mileage',
      impact: 'negative',
      detail: `${Math.round(((mileage - expectedMileage) / expectedMileage) * 100)}% above average for age`,
    });
  } else {
    valueFactors.push({
      label: 'Average Mileage',
      impact: 'neutral',
      detail: 'Within expected range for vehicle age',
    });
  }

  // Ownership factor
  if (vehicle.noOfOwners === 1) {
    valueFactors.push({
      label: 'Single Owner',
      impact: 'positive',
      detail: 'First owner vehicles typically command premium',
    });
  } else if (vehicle.noOfOwners && vehicle.noOfOwners >= 3) {
    valueFactors.push({
      label: 'Multiple Owners',
      impact: 'negative',
      detail: 'Multiple ownership may indicate issues',
    });
  }

  // Service history
  if (vehicle.serviceRecords && vehicle.serviceRecords.length > 0) {
    valueFactors.push({
      label: 'Service History',
      impact: 'positive',
      detail: 'Documented maintenance records available',
    });
  }

  // Insurance
  if (vehicle.insuranceType === 'Comprehensive') {
    valueFactors.push({
      label: 'Comprehensive Insurance',
      impact: 'positive',
      detail: 'Full coverage indicates well-maintained vehicle',
    });
  }

  // Certification
  if (vehicle.certificationStatus === 'certified' || vehicle.certifiedInspection) {
    valueFactors.push({
      label: 'Certified Inspection',
      impact: 'positive',
      detail: 'Professional inspection completed',
    });
  }

  return {
    fairnessScore,
    fairnessLabel,
    marketLow: Math.round(marketLow),
    marketHigh: Math.round(marketHigh),
    marketAverage: Math.round(marketAverage),
    priceDifferencePercent: Math.round(priceDifferencePercent),
    priceDifferenceAmount: Math.round(priceDifferenceAmount),
    depreciationEstimate,
    valueFactors,
  };
}

/**
 * Format price in Indian rupee format
 */
function formatPrice(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakh`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Get color for fairness score
 */
function getFairnessColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 65) return '#84cc16'; // lime
  if (score >= 50) return '#eab308'; // yellow
  if (score >= 35) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Price meter visualization
 */
const PriceMeter: React.FC<{
  price: number;
  marketLow: number;
  marketHigh: number;
  marketAverage: number;
}> = ({ price, marketLow, marketHigh, marketAverage }) => {
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
      {/* Track */}
      <div className="h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 relative">
        {/* Market range indicator */}
        <div
          className="absolute h-full bg-blue-200/50 rounded-full"
          style={{ left: `${lowPosition}%`, width: `${highPosition - lowPosition}%` }}
        />
        
        {/* Average marker */}
        <div
          className="absolute w-0.5 h-5 bg-blue-600 -top-1"
          style={{ left: `${avgPosition}%` }}
          title={`Market Average: ${formatPrice(marketAverage)}`}
        />
        
        {/* Price marker */}
        <div
          className="absolute w-4 h-4 bg-white border-4 border-reride-orange rounded-full -top-0.5 transform -translate-x-1/2 shadow-lg"
          style={{ left: `${pricePosition}%` }}
        />
      </div>
      
      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Great Deal</span>
        <span className="text-blue-600 font-medium">Market Avg</span>
        <span>Overpriced</span>
      </div>
    </div>
  );
};

/**
 * Compact price badge for vehicle cards
 */
export const PriceFairnessBadge: React.FC<{ 
  fairnessLabel: PriceAnalysis['fairnessLabel'];
  priceDifferencePercent: number;
}> = ({ fairnessLabel, priceDifferencePercent }) => {
  const colors: Record<PriceAnalysis['fairnessLabel'], string> = {
    'Great Deal': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Good Price': 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
    'Fair Price': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'Above Market': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'Overpriced': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[fairnessLabel]}`}>
      {fairnessLabel}
      {priceDifferencePercent !== 0 && (
        <span className="ml-1 opacity-75">
          ({priceDifferencePercent > 0 ? '+' : ''}{priceDifferencePercent}%)
        </span>
      )}
    </span>
  );
};

/**
 * Main Price Insights Component
 */
export const PriceInsights: React.FC<PriceInsightsProps> = ({
  vehicle,
  similarVehicles = [],
  compact = false,
}) => {
  const [showDetails, setShowDetails] = useState(!compact);

  const analysis = useMemo(
    () => analyzePricing(vehicle, similarVehicles),
    [vehicle, similarVehicles]
  );

  if (compact) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPrice(vehicle.price)}
            </p>
            <PriceFairnessBadge 
              fairnessLabel={analysis.fairnessLabel}
              priceDifferencePercent={analysis.priceDifferencePercent}
            />
          </div>
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: getFairnessColor(analysis.fairnessScore) }}
          >
            {analysis.fairnessScore}
          </div>
        </div>
        <button
          onClick={() => setShowDetails(true)}
          className="mt-3 text-sm text-reride-orange hover:underline"
        >
          View price analysis →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span>💰</span> Price Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Based on {similarVehicles.length || 'market'} similar listings
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPrice(vehicle.price)}
            </p>
            <PriceFairnessBadge 
              fairnessLabel={analysis.fairnessLabel}
              priceDifferencePercent={analysis.priceDifferencePercent}
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Price Meter */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Price Position in Market
          </p>
          <PriceMeter
            price={vehicle.price}
            marketLow={analysis.marketLow}
            marketHigh={analysis.marketHigh}
            marketAverage={analysis.marketAverage}
          />
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Market Low</p>
              <p className="font-semibold text-green-600">{formatPrice(analysis.marketLow)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Average</p>
              <p className="font-semibold text-blue-600">{formatPrice(analysis.marketAverage)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Market High</p>
              <p className="font-semibold text-red-600">{formatPrice(analysis.marketHigh)}</p>
            </div>
          </div>
        </div>

        {/* Fairness Score */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg"
            style={{ backgroundColor: getFairnessColor(analysis.fairnessScore) }}
          >
            {analysis.fairnessScore}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
              {analysis.fairnessLabel}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {analysis.priceDifferencePercent < 0 
                ? `${Math.abs(analysis.priceDifferencePercent)}% below market average`
                : analysis.priceDifferencePercent > 0
                  ? `${analysis.priceDifferencePercent}% above market average`
                  : 'At market average price'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Difference: {formatPrice(Math.abs(analysis.priceDifferenceAmount))}
              {analysis.priceDifferenceAmount < 0 ? ' savings' : ' premium'}
            </p>
          </div>
        </div>

        {/* Value Factors */}
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Value Factors</h4>
          <div className="space-y-2">
            {analysis.valueFactors.map((factor, idx) => (
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

        {/* Depreciation Estimate */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span>📉</span>
            <h4 className="font-semibold text-gray-900 dark:text-white">Depreciation Estimate</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Expected value decrease in next 12 months: 
            <span className="font-semibold text-yellow-700 dark:text-yellow-400 ml-1">
              ~{formatPrice(analysis.depreciationEstimate)}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Based on typical depreciation for {new Date().getFullYear() - vehicle.year} year old vehicles
          </p>
        </div>

        {/* EMI Quick Estimate */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span>🏦</span>
            <h4 className="font-semibold text-gray-900 dark:text-white">EMI Estimate</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-blue-600">
                {formatPrice(Math.round((vehicle.price * 0.8 * 0.09 / 12) / (1 - Math.pow(1 + 0.09/12, -36)) ))}
              </p>
              <p className="text-xs text-gray-500">3 Year EMI</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">
                {formatPrice(Math.round((vehicle.price * 0.8 * 0.09 / 12) / (1 - Math.pow(1 + 0.09/12, -48)) ))}
              </p>
              <p className="text-xs text-gray-500">4 Year EMI</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">
                {formatPrice(Math.round((vehicle.price * 0.8 * 0.09 / 12) / (1 - Math.pow(1 + 0.09/12, -60)) ))}
              </p>
              <p className="text-xs text-gray-500">5 Year EMI</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            *Based on 80% financing at 9% interest rate. Actual EMI may vary.
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-gray-500 text-center">
          Price analysis is based on available market data and may not reflect all factors.
          Always negotiate based on vehicle condition and documentation.
        </p>
      </div>
    </div>
  );
};

export default PriceInsights;
