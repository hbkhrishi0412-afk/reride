import React, { useState, useEffect } from 'react';
import { sendOTP, verifyOTP, syncWithBackend, initializeRecaptcha, cleanupRecaptcha } from '../services/authService';
import { User } from '../types';
import useIsMobileApp from '../hooks/useIsMobileApp';

interface OTPLoginProps {
  onLogin: (user: User) => void;
  role: 'customer' | 'seller';
  onCancel: () => void;
}

const OTPLogin: React.FC<OTPLoginProps> = ({ onLogin, role, onCancel }) => {
  const { isMobileApp } = useIsMobileApp();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    // Initialize reCAPTCHA when component mounts
    initializeRecaptcha();
    
    return () => {
      // Cleanup on unmount
      cleanupRecaptcha();
    };
  }, []);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!phoneNumber) {
        throw new Error('Please enter your phone number');
      }

      // Validate Indian phone number format
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneNumber.replace(/^(\+91)?/, ''))) {
        throw new Error('Please enter a valid 10-digit Indian mobile number');
      }

      const result = await sendOTP(phoneNumber);
      
      if (result.success && result.confirmationResult) {
        setConfirmationResult(result.confirmationResult);
        setOtpSent(true);
      } else {
        throw new Error(result.reason || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!confirmationResult) {
        throw new Error('Please request OTP first');
      }

      if (!otp || otp.length !== 6) {
        throw new Error('Please enter the 6-digit OTP');
      }

      const result = await verifyOTP(confirmationResult, otp);
      
      if (result.success && result.firebaseUser) {
        // Sync with backend
        const backendResult = await syncWithBackend(result.firebaseUser, role, 'phone');
        
        if (backendResult.success && backendResult.user) {
          onLogin(backendResult.user);
        } else {
          throw new Error(backendResult.reason || 'Failed to authenticate with backend');
        }
      } else {
        throw new Error(result.reason || 'Invalid OTP');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtp('');
    setOtpSent(false);
    setConfirmationResult(null);
    await handleSendOTP(new Event('submit') as any);
  };

  // Mobile App UI
  if (isMobileApp) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-2 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Login with Mobile OTP
          </h3>
          <p className="text-sm text-white/90 font-medium">
            We'll send you a one-time password
          </p>
        </div>

        {!otpSent ? (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div>
              <div className="flex">
                <span className="inline-flex items-center px-4 py-4 rounded-l-2xl bg-white/20 backdrop-blur-sm text-white text-base font-semibold border border-white/30">
                  +91
                </span>
                <input
                  id="phone-number"
                  type="tel"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-5 py-4 text-base bg-white/95 backdrop-blur-sm border-0.5 border-white/30 rounded-r-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-600 text-sm text-center font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-4 px-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white font-semibold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-4 px-4 rounded-2xl font-bold text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
                }}
                onMouseDown={(e) => {
                  if (!isLoading) e.currentTarget.style.transform = 'scale(0.97)';
                }}
                onMouseUp={(e) => {
                  if (!isLoading) e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-5 py-4 text-3xl text-center tracking-[0.5em] bg-white/95 backdrop-blur-sm border-0.5 border-white/30 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white transition-all font-bold"
                required
              />
              <p className="text-xs text-white/80 mt-3 text-center font-medium">
                Sent to +91 {phoneNumber}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-600 text-sm text-center font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isLoading}
                className="flex-1 py-4 px-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                Resend OTP
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-4 px-4 rounded-2xl font-bold text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
                }}
                onMouseDown={(e) => {
                  if (!isLoading) e.currentTarget.style.transform = 'scale(0.97)';
                }}
                onMouseUp={(e) => {
                  if (!isLoading) e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          </form>
        )}

        {/* Invisible reCAPTCHA container */}
        <div id="recaptcha-container"></div>
      </div>
    );
  }

  // Desktop UI
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-reride-text-dark mb-2">
          Login with Mobile OTP
        </h3>
        <p className="text-sm text-gray-600">
          We'll send you a one-time password
        </p>
      </div>

      {!otpSent ? (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                +91
              </span>
              <input
                id="phone-number"
                type="tel"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-reride-orange focus:border-reride-orange"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-reride-orange text-white rounded-md hover:bg-reride-orange-dark focus:outline-none focus:ring-2 focus:ring-reride-orange focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
              Enter OTP
            </label>
            <input
              id="otp"
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-reride-orange focus:border-reride-orange text-center text-2xl tracking-widest"
              required
            />
            <p className="text-xs text-gray-600 mt-2">
              Sent to +91 {phoneNumber}
            </p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Resend OTP
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-reride-orange text-white rounded-md hover:bg-reride-orange-dark focus:outline-none focus:ring-2 focus:ring-reride-orange focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </form>
      )}

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </div>
  );
};

export default OTPLogin;

