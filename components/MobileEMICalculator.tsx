import React, { useState, useMemo, useEffect } from 'react';
import { MobileFilterSheet } from './MobileFilterSheet';

interface MobileEMICalculatorProps {
  price: number;
  onClose: () => void;
}

/**
 * Mobile EMI Calculator Bottom Sheet
 * Touch-friendly sliders and results display
 */
export const MobileEMICalculator: React.FC<MobileEMICalculatorProps> = ({
  price,
  onClose
}) => {
  const minDownPayment = Math.round(price * 0.1);
  const maxLoanAmount = price - minDownPayment;

  const [loanAmount, setLoanAmount] = useState(Math.round(price * 0.8));
  const [interestRate, setInterestRate] = useState(10.5);
  const [tenure, setTenure] = useState(60); // in months

  const downPayment = useMemo(() => price - loanAmount, [price, loanAmount]);
  const maxTenure = 84; // 7 years

  const emi = useMemo(() => {
    if (loanAmount <= 0) return 0;
    const monthlyRate = interestRate / 12 / 100;
    const n = tenure;
    if (monthlyRate === 0) return loanAmount / n;
    const calculatedEmi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    return Math.round(calculatedEmi);
  }, [loanAmount, interestRate, tenure]);

  const totalAmount = useMemo(() => emi * tenure, [emi, tenure]);
  const totalInterest = useMemo(() => totalAmount - loanAmount, [totalAmount, loanAmount]);

  useEffect(() => {
    const newMinDownPayment = Math.round(price * 0.1);
    const newMaxLoanAmount = price - newMinDownPayment;
    setLoanAmount(Math.min(Math.round(price * 0.8), newMaxLoanAmount));
  }, [price]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <MobileFilterSheet
      isOpen={true}
      onClose={onClose}
      title="EMI Calculator"
    >
      <div className="py-4 space-y-6">
        {/* Results Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
          <div className="text-center mb-4">
            <p className="text-sm opacity-90 mb-1">Monthly EMI</p>
            <p className="text-4xl font-bold">{formatCurrency(emi)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-xs opacity-90 mb-1">Total Amount</p>
              <p className="text-lg font-semibold">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs opacity-90 mb-1">Total Interest</p>
              <p className="text-lg font-semibold">{formatCurrency(totalInterest)}</p>
            </div>
          </div>
        </div>

        {/* Loan Amount Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Loan Amount</label>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(loanAmount)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={maxLoanAmount}
            step="1000"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${(loanAmount / maxLoanAmount) * 100}%, #e5e7eb ${(loanAmount / maxLoanAmount) * 100}%, #e5e7eb 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatCurrency(0)}</span>
            <span>{formatCurrency(maxLoanAmount)}</span>
          </div>
        </div>

        {/* Down Payment Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Down Payment</label>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(downPayment)}</span>
          </div>
          <input
            type="range"
            min={minDownPayment}
            max={price}
            step="1000"
            value={downPayment}
            onChange={(e) => {
              const newDownPayment = Number(e.target.value);
              const newLoanAmount = price - newDownPayment;
              if (newLoanAmount >= 0 && newLoanAmount <= maxLoanAmount) {
                setLoanAmount(newLoanAmount);
              }
            }}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${((downPayment - minDownPayment) / (price - minDownPayment)) * 100}%, #e5e7eb ${((downPayment - minDownPayment) / (price - minDownPayment)) * 100}%, #e5e7eb 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatCurrency(minDownPayment)}</span>
            <span>{formatCurrency(price)}</span>
          </div>
        </div>

        {/* Interest Rate Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Interest Rate</label>
            <span className="text-lg font-bold text-gray-900">{interestRate}% p.a.</span>
          </div>
          <input
            type="range"
            min="7"
            max="18"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${((interestRate - 7) / (18 - 7)) * 100}%, #e5e7eb ${((interestRate - 7) / (18 - 7)) * 100}%, #e5e7eb 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>7%</span>
            <span>18%</span>
          </div>
        </div>

        {/* Tenure Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Loan Tenure</label>
            <span className="text-lg font-bold text-gray-900">{tenure} months ({Math.round(tenure / 12)} years)</span>
          </div>
          <input
            type="range"
            min="12"
            max={maxTenure}
            step="6"
            value={tenure}
            onChange={(e) => setTenure(Number(e.target.value))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${((tenure - 12) / (maxTenure - 12)) * 100}%, #e5e7eb ${((tenure - 12) / (maxTenure - 12)) * 100}%, #e5e7eb 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 year</span>
            <span>7 years</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={() => setLoanAmount(Math.round(price * 0.7))}
            className="py-2 px-3 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 active:bg-gray-200"
          >
            70% Loan
          </button>
          <button
            onClick={() => setLoanAmount(Math.round(price * 0.8))}
            className="py-2 px-3 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 active:bg-gray-200"
          >
            80% Loan
          </button>
          <button
            onClick={() => setLoanAmount(Math.round(price * 0.9))}
            className="py-2 px-3 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 active:bg-gray-200"
          >
            90% Loan
          </button>
        </div>
      </div>
    </MobileFilterSheet>
  );
};

export default MobileEMICalculator;












