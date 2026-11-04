import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTooltip } from './HelpTooltip';

// Combobox component for Make, Model, and Variant fields
export const ComboboxInput: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  options: string[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  tooltip?: string;
}> = ({ label, name, value, onChange, options, placeholder, error, required = false, disabled = false, tooltip }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure options is always an array
  const safeOptions = Array.isArray(options) ? options : [];

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Filter options based on input
  useEffect(() => {
    if (!inputValue || inputValue.trim() === '') {
      setFilteredOptions(safeOptions);
    } else {
      const filtered = safeOptions.filter(opt => 
        opt && typeof opt === 'string' && opt.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [inputValue, safeOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const newValue = e.target.value || '';
      setInputValue(newValue);
      setIsOpen(true);
      onChange(e);
    } catch (error) {
      console.error('Error in handleInputChange:', error);
    }
  };

  const handleSelectOption = (option: string) => {
    if (!option || typeof option !== 'string') return;
    setInputValue(option);
    setIsOpen(false);
    // Create synthetic event for onChange
    try {
      // Create a minimal event object that handleChange expects
      const syntheticEvent = {
        target: {
          name,
          value: option
        } as HTMLInputElement,
        currentTarget: inputRef.current
      } as React.ChangeEvent<HTMLInputElement>;
      
      onChange(syntheticEvent);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error in handleSelectOption:', error);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    try {
      if (e.key === 'ArrowDown' && Array.isArray(filteredOptions) && filteredOptions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'Enter' && isOpen && Array.isArray(filteredOptions) && filteredOptions.length > 0 && filteredOptions[0]) {
        e.preventDefault();
        handleSelectOption(filteredOptions[0]);
      }
    } catch (error) {
      console.error('Error in handleInputKeyDown:', error);
    }
  };

  // Safety check - ensure we have valid data before rendering
  if (typeof name !== 'string' || name.length === 0) {
    console.error('ComboboxInput: Invalid name prop');
    return null;
  }

  return (
    <div className="relative">
      <label htmlFor={name} className="mb-1 flex items-center text-[13px] font-semibold text-stone-800">
        {label}{required && <span className="ml-0.5 text-reride-orange">*</span>}
        {tooltip && <HelpTooltip text={tooltip} />}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={name}
          name={name}
          value={inputValue || ''}
          onChange={handleInputChange}
          onFocus={(e) => {
            handleInputFocus();
            if (!error) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.14)';
          }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = ''; }}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          className={`block w-full rounded-lg border bg-white px-3 py-2.5 pr-10 text-sm text-stone-900 placeholder:text-stone-500 transition focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500 ${error ? 'border-reride-orange' : 'border-stone-300 hover:border-stone-400'}`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="h-4 w-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {isOpen && !disabled && Array.isArray(filteredOptions) && filteredOptions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg shadow-stone-900/10"
          >
            {filteredOptions.slice(0, 10).map((option, index) => {
              if (!option || typeof option !== 'string') return null;
              return (
                <button
                  key={option || `option-${index}`}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className="w-full px-3.5 py-2.5 text-left text-sm text-stone-800 transition-colors hover:bg-orange-50 focus:bg-orange-50 focus:outline-none"
                >
                  {option}
                </button>
              );
            })}
            {filteredOptions.length > 10 && (
              <div className="px-3.5 py-2 text-center text-xs text-stone-400">
                {t('sellerDashboard.comboboxMoreOptions', {
                  count: filteredOptions.length - 10,
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-reride-orange">{error}</p>}
    </div>
  );
};
