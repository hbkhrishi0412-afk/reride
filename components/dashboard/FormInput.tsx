import React from 'react';
import type { Vehicle } from '../../types';
import { formatIndianNumberInput, parseIndianNumberDigits } from '../../utils/indianNumberInput.js';
import { HelpTooltip } from './HelpTooltip';

const inputClass = (error?: string) =>
  `block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500 ${
    error
      ? 'border-reride-orange'
      : 'border-stone-300 hover:border-stone-400'
  }`;

export const FormInput: React.FC<{
  label: string;
  name: keyof Vehicle | 'summary';
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  tooltip?: string;
  required?: boolean;
  children?: React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  indianNumberFormat?: boolean;
}> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  tooltip,
  required = false,
  children,
  disabled = false,
  placeholder,
  rows,
  prefix,
  suffix,
  indianNumberFormat = false,
}) => {
  const focusOn = (e: React.FocusEvent<HTMLElement>) => {
    if (!error) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.14)';
  };
  const focusOff = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = '';
  };
  const inputType = indianNumberFormat ? 'text' : type;
  const displayValue = indianNumberFormat ? formatIndianNumberInput(value) : value;
  const handleFormattedNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = parseIndianNumberDigits(e.target.value);
    onChange({
      ...e,
      target: { ...e.target, name: e.target.name, value: digits },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div>
      <label htmlFor={String(name)} className="mb-1 flex items-center text-[13px] font-semibold text-stone-800">
        {label}
        {required ? <span className="ml-0.5 text-reride-orange">*</span> : null}
        {tooltip ? <HelpTooltip text={tooltip} /> : null}
      </label>
      {type === 'select' ? (
        <select
          id={String(name)}
          name={String(name)}
          value={String(value)}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={inputClass(error)}
          onFocus={focusOn}
          onBlur={focusOff}
        >
          {children}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={String(name)}
          name={String(name)}
          value={String(value)}
          onChange={onChange}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          className={inputClass(error)}
          onFocus={focusOn}
          onBlur={focusOff}
        />
      ) : (
        <div className="relative">
          {prefix ? (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-stone-600">
              {prefix}
            </span>
          ) : null}
          <input
            type={inputType}
            id={String(name)}
            name={String(name)}
            value={displayValue}
            onChange={indianNumberFormat ? handleFormattedNumberChange : onChange}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            inputMode={indianNumberFormat ? 'numeric' : undefined}
            className={`${inputClass(error)} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''}`}
            onFocus={focusOn}
            onBlur={(e) => {
              focusOff(e);
              if (!onBlur) return;
              if (indianNumberFormat) {
                const digits = parseIndianNumberDigits(e.target.value);
                onBlur({
                  ...e,
                  target: { ...e.target, name: e.target.name, value: digits },
                } as React.FocusEvent<HTMLInputElement>);
                return;
              }
              onBlur(e);
            }}
          />
          {suffix ? (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-medium text-stone-600">
              {suffix}
            </span>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-reride-orange">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
};
