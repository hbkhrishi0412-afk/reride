/**
 * Simple car valuation estimator based on ex-showroom, year, mileage.
 * Uses a rough depreciation model; production would use an API (e.g. CARS24/OLX valuation).
 */

import React, { useState } from 'react';

interface CarValuationProps {
  className?: string;
}

const DEPRECIATION_PER_YEAR = 0.15;
const DEPRECIATION_PER_10K_KM = 0.02;

export default function CarValuation({ className = '' }: CarValuationProps) {
  const [exShowroom, setExShowroom] = useState(800000);
  const [year, setYear] = useState(new Date().getFullYear() - 2);
  const [mileage, setMileage] = useState(25000);

  const yearsOld = Math.max(0, new Date().getFullYear() - year);
  const ageFactor = Math.pow(1 - DEPRECIATION_PER_YEAR, yearsOld);
  const kmFactor = 1 - (mileage / 10000) * DEPRECIATION_PER_10K_KM;
  const estimatedValue = Math.round(exShowroom * Math.max(0.2, ageFactor * Math.max(0.5, kmFactor)));

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">Car Valuation</h3>
      <p className="mt-1 text-sm text-gray-500">Rough estimate based on age and mileage</p>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Ex-showroom price (₹)</label>
          <input
            type="number"
            min={100000}
            max={50000000}
            step={50000}
            value={exShowroom}
            onChange={(e) => setExShowroom(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Year of manufacture</label>
          <input
            type="number"
            min={2000}
            max={new Date().getFullYear()}
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mileage (km)</label>
          <input
            type="number"
            min={0}
            max={500000}
            step={1000}
            value={mileage}
            onChange={(e) => setMileage(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Estimated value</span>
          <span className="text-xl font-bold text-orange-600">₹{estimatedValue.toLocaleString('en-IN')}</span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          This is an indicative value. For accurate valuation, get a professional inspection.
        </p>
      </div>
    </div>
  );
}
