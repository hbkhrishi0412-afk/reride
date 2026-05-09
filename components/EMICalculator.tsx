/**
 * Desktop EMI calculator for vehicle detail (mirrors mobile UX: sliders + summary card).
 * EMI = standard reducing balance: P * r * (1+r)^n / ((1+r)^n - 1)
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface EMICalculatorProps {
  /** Vehicle on-road / list price (₹). */
  principal?: number;
  onEmiChange?: (emi: number, totalInterest: number) => void;
  /** Optional close control (e.g. collapse inline panel). */
  onClose?: () => void;
  className?: string;
}

const MAX_TENURE = 84;
const INTEREST_MIN = 7;
const INTEREST_MAX = 18;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export default function EMICalculator({
  principal: vehiclePrice = 500000,
  onEmiChange,
  onClose,
  className = '',
}: EMICalculatorProps) {
  const { t } = useTranslation();
  const price = Math.max(0, Number(vehiclePrice) || 0);

  const minDownPayment = useMemo(() => (price > 0 ? Math.round(price * 0.1) : 0), [price]);
  const maxLoanAmount = useMemo(() => Math.max(0, price - minDownPayment), [price, minDownPayment]);

  const [loanAmount, setLoanAmount] = useState(() =>
    price > 0 ? Math.min(Math.round(price * 0.8), price - Math.round(price * 0.1)) : 0,
  );
  const [interestRate, setInterestRate] = useState(10.5);
  const [tenure, setTenure] = useState(60);

  useEffect(() => {
    if (price <= 0) {
      setLoanAmount(0);
      return;
    }
    const minDp = Math.round(price * 0.1);
    const maxLoan = Math.max(0, price - minDp);
    setLoanAmount((prev) => clamp(prev, 0, maxLoan || 0));
  }, [price]);

  const downPayment = useMemo(() => price - loanAmount, [price, loanAmount]);

  const emi = useMemo(() => {
    if (loanAmount <= 0 || tenure <= 0) return 0;
    const monthlyRate = interestRate / 12 / 100;
    const n = tenure;
    if (monthlyRate === 0) return Math.round(loanAmount / n);
    const v =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    return Math.round(v);
  }, [loanAmount, interestRate, tenure]);

  const totalAmount = useMemo(() => emi * tenure, [emi, tenure]);
  const totalInterest = useMemo(() => Math.max(0, totalAmount - loanAmount), [totalAmount, loanAmount]);

  useEffect(() => {
    onEmiChange?.(emi, totalInterest);
  }, [emi, totalInterest, onEmiChange]);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  const loanPct = maxLoanAmount > 0 ? (loanAmount / maxLoanAmount) * 100 : 0;
  const dpRange = price - minDownPayment;
  const downPct = dpRange > 0 ? ((downPayment - minDownPayment) / dpRange) * 100 : 0;
  const ratePct = ((interestRate - INTEREST_MIN) / (INTEREST_MAX - INTEREST_MIN)) * 100;
  const tenurePct = ((tenure - 12) / (MAX_TENURE - 12)) * 100;

  const setLoanFromDownPayment = (dp: number) => {
    const d = clamp(dp, minDownPayment, price);
    setLoanAmount(price - d);
  };

  if (price <= 0) {
    return (
      <div
        className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
        role="region"
        aria-label="EMI calculator"
      >
        <p className="text-sm text-slate-600">Set a valid vehicle price to estimate EMI.</p>
      </div>
    );
  }

  return (
    <div
      className={`emi-calc-root rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-lg ${className}`}
      role="region"
      aria-label="EMI calculator"
    >
      <style>{`
        .emi-calc-root input[type='range'] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 12px;
          border-radius: 9999px;
          outline: none;
        }
        .emi-calc-root input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #9333ea;
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.22);
          margin-top: -6px;
          cursor: pointer;
        }
        .emi-calc-root input[type='range']::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #9333ea;
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.22);
          cursor: pointer;
        }
        .emi-calc-root input[type='range']::-webkit-slider-runnable-track {
          height: 10px;
          border-radius: 9999px;
        }
        .emi-calc-root input[type='range']::-moz-range-track {
          height: 10px;
          border-radius: 9999px;
        }
      `}</style>

      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">EMI Calculator</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Adjust loan, down payment, rate and tenure — estimates only.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            aria-label="Close EMI calculator"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row-reverse gap-8 lg:items-start">
        {/* Summary card — right on large screens */}
        <div className="w-full lg:max-w-sm lg:shrink-0">
          <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-6 sm:p-7 text-white shadow-md">
            <div className="text-center mb-4">
              <p className="text-sm opacity-90 mb-1">{t('vehicle.detail.price.monthlyEmi')}</p>
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight">{formatCurrency(emi)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <div>
                <p className="text-xs opacity-90 mb-1">Total amount</p>
                <p className="text-base sm:text-lg font-semibold tabular-nums">{formatCurrency(totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs opacity-90 mb-1">Total interest</p>
                <p className="text-base sm:text-lg font-semibold tabular-nums">{formatCurrency(totalInterest)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls — left / full width */}
        <div className="flex-1 min-w-0 space-y-6">
          <SliderBlock
            label="Loan amount"
            valueLabel={formatCurrency(loanAmount)}
            min={0}
            max={maxLoanAmount}
            step={1000}
            value={loanAmount}
            onChange={(v) => setLoanAmount(clamp(v, 0, maxLoanAmount))}
            fillPct={loanPct}
            minLabel={formatCurrency(0)}
            maxLabel={formatCurrency(maxLoanAmount)}
            inputValue={loanAmount}
            onInputNumber={(v) => setLoanAmount(clamp(Math.round(v), 0, maxLoanAmount))}
          />

          <SliderBlock
            label="Down payment"
            valueLabel={formatCurrency(downPayment)}
            min={minDownPayment}
            max={price}
            step={1000}
            value={downPayment}
            onChange={(v) => setLoanFromDownPayment(v)}
            fillPct={downPct}
            minLabel={formatCurrency(minDownPayment)}
            maxLabel={formatCurrency(price)}
            inputValue={downPayment}
            onInputNumber={(v) => setLoanFromDownPayment(Math.round(v))}
          />

          <SliderBlock
            label="Interest rate"
            valueLabel={`${interestRate.toFixed(1)}% p.a.`}
            min={INTEREST_MIN}
            max={INTEREST_MAX}
            step={0.1}
            value={interestRate}
            onChange={(v) => setInterestRate(clamp(v, INTEREST_MIN, INTEREST_MAX))}
            fillPct={ratePct}
            minLabel={`${INTEREST_MIN}%`}
            maxLabel={`${INTEREST_MAX}%`}
            inputValue={interestRate}
            onInputNumber={(v) => setInterestRate(clamp(Number(v), INTEREST_MIN, INTEREST_MAX))}
            inputStep={0.1}
          />

          <SliderBlock
            label="Loan tenure"
            valueLabel={`${tenure} mo (${Math.round(tenure / 12)} yr)`}
            min={12}
            max={MAX_TENURE}
            step={6}
            value={tenure}
            onChange={(v) => setTenure(clamp(v, 12, MAX_TENURE))}
            fillPct={tenurePct}
            minLabel="1 year"
            maxLabel="7 years"
            inputValue={tenure}
            onInputNumber={(v) => setTenure(clamp(Math.round(v / 6) * 6, 12, MAX_TENURE))}
            inputStep={6}
          />

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            {[
              { label: '70% loan', pct: 0.7 },
              { label: '80% loan', pct: 0.8 },
              { label: '90% loan', pct: 0.9 },
            ].map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => setLoanAmount(clamp(Math.round(price * row.pct), 0, maxLoanAmount))}
                className="py-2.5 px-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                {row.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderBlock(props: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  fillPct: number;
  minLabel: string;
  maxLabel: string;
  inputValue: number;
  onInputNumber: (n: number) => void;
  inputStep?: number;
}) {
  const {
    label,
    valueLabel,
    min,
    max,
    step,
    value,
    onChange,
    fillPct,
    minLabel,
    maxLabel,
    inputValue,
    onInputNumber,
    inputStep = 1,
  } = props;
  const pct = Math.min(100, Math.max(0, fillPct));
  const track = `linear-gradient(to right, #FF6B35 0%, #FF6B35 ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">{valueLabel}</span>
          <input
            type="number"
            min={min}
            max={max}
            step={inputStep}
            value={Number.isFinite(inputValue) ? inputValue : ''}
            onChange={(e) => {
              const raw = e.target.value === '' ? NaN : Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              onInputNumber(raw);
            }}
            className="w-24 sm:w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right font-semibold text-slate-900 tabular-nums focus:border-reride-orange focus:ring-1 focus:ring-orange-200 outline-none"
            aria-label={`${label} numeric`}
          />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ background: track }}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <div className="flex justify-between text-xs text-slate-500 mt-1.5 tabular-nums">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
