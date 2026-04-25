import React, { useState } from 'react';

interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
  error?: string;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = "Password",
  className = "",
  autoComplete = "current-password",
  required = false,
  disabled = false,
  label,
  showLabel = true,
  error
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const baseInputClass = "appearance-none relative block w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl placeholder-gray-500 text-gray-800 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-300 sm:text-sm";
  const inputClass = `${baseInputClass} ${className}`;

  return (
    <div className="space-y-2">
      {showLabel && label && (
        <label htmlFor={id || name} className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative group">
        <input
          id={id || name}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClass}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute inset-y-0 right-2 my-auto h-8 w-8 inline-flex items-center justify-center rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:text-blue-600 transition-colors duration-200"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          disabled={disabled}
        >
          {showPassword ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3l18 18M10.58 10.58A3 3 0 0013.42 13.42M9.88 5.09A9.77 9.77 0 0112 4.8c5.05 0 9.27 3.11 10.8 7.2a11.8 11.8 0 01-4.05 5.37M6.1 6.1A11.77 11.77 0 001.2 12a11.78 11.78 0 004.42 5.03A9.76 9.76 0 0012 19.2c1.6 0 3.1-.39 4.42-1.07"
              />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.46 12C3.73 7.94 7.53 4.8 12 4.8s8.27 3.14 9.54 7.2c-1.27 4.06-5.07 7.2-9.54 7.2S3.73 16.06 2.46 12z"
              />
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}
    </div>
  );
};

export default PasswordInput;
