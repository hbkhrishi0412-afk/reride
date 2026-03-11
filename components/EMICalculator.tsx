/**
 * EMI calculator for car loans.
 * Uses standard formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 */

import React, { useState } from 'react';

interface EMICalculatorProps {
  principal?: number;
  onEmiChange?: (emi: number, totalInterest: number) => void;
  className?: string;
}

const DEFAULT_RATE = 9.5;
const DEFAULT_TENURE_MONTHS = 60;

export default function EMICalculator({
  principal: initialPrincipal = 500000,
  onEmiChange,
  className = '',
}: EMICalculatorProps) {
  const [principal, setPrincipal] = useState(initialPrincipal);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [tenureMonths, setTenureMonths] = useState(DEFAULT_TENURE_MONTHS);

  const r = rate / 100 / 12;
  const n = tenureMonths;
  const emi = n > 0
    ? (r > 0 ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : principal / n)
    : 0;
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;

  React.useEffect(() => {
    onEmiChange?.(Math.round(emi), Math.round(totalInterest));
  }, [emi, totalInterest, onEmiChange]);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">EMI Calculator</h3>
      <p className="mt-1 text-sm text-gray-500">Estimate your monthly instalment</p>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Loan amount (₹)</label>
          <input
            type="number"
            min={50000}
            max={50000000}
            step={50000}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Interest rate (% p.a.)</label>
          <input
            type="number"
            min={1}
            max={25}
            step={0.5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Tenure (months)</label>
          <select
            value={tenureMonths}
            onChange={(e) => setTenureMonths(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {[12, 24, 36, 48, 60, 72, 84].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Monthly EMI</span>
          <span className="font-semibold text-orange-600">₹{Math.round(emi).toLocaleString('en-IN')}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-gray-600">Total interest</span>
          <span className="text-gray-800">₹{Math.round(totalInterest).toLocaleString('en-IN')}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-gray-600">Total amount</span>
          <span className="text-gray-800">₹{Math.round(totalPayment).toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
}
