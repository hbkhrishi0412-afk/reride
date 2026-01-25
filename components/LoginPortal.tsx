import React from 'react';
import { View } from '../types';
import Logo from './Logo';
import useIsMobileApp from '../hooks/useIsMobileApp';

interface LoginPortalProps {
  onNavigate: (view: View) => void;
}

const LoginPortal: React.FC<LoginPortalProps> = ({ onNavigate }) => {
  const { isMobileApp } = useIsMobileApp();

  // Mobile App UI
  if (isMobileApp) {
    return (
      <div 
        className="w-full min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          background: 'linear-gradient(180deg, #6366F1 0%, #8B5CF6 40%, #A855F7 70%, #EC4899 100%)',
          minHeight: '100vh'
        }}
      >
        <div className="w-full max-w-md space-y-6">
          {/* Logo and Welcome */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/30">
                <Logo className="scale-150 filter brightness-0 invert" showText={false} />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Welcome to ReRide
            </h1>
            <p className="text-white/90 text-base font-medium">
              Please select your role to continue
            </p>
          </div>

          {/* Role Selection Card */}
          <div 
            className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/30"
            style={{
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div className="space-y-4">
              <button
                onClick={() => onNavigate(View.CUSTOMER_LOGIN)}
                className="w-full py-4 px-6 rounded-2xl font-bold text-base text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
                }}
              >
                I am a Customer
              </button>
              <button
                onClick={() => onNavigate(View.SELLER_LOGIN)}
                className="w-full py-4 px-6 rounded-2xl font-bold text-base text-gray-700 bg-white border-2 border-gray-200 transition-all active:scale-95"
                style={{
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                I am a Seller
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => onNavigate(View.USED_CARS)}
                className="w-full text-sm font-semibold text-gray-600 py-2"
              >
                Or continue as a guest →
              </button>
              <button
                onClick={() => onNavigate(View.ADMIN_LOGIN)}
                className="w-full text-sm font-medium text-gray-500 py-2 mt-2"
              >
                Administrator Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop UI
  return (
    <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl text-center">
      <div className="flex justify-center mb-4">
        <Logo className="scale-125" showText={false} />
      </div>
      <h2 className="text-2xl font-extrabold text-reride-text-dark dark:text-reride-text-dark">Welcome to ReRide</h2>
      <p className="mt-2 text-brand-gray-600 dark:text-reride-text">Please select your role to continue.</p>
      <div className="mt-8 space-y-4">
        <button
          onClick={() => onNavigate(View.CUSTOMER_LOGIN)}
          className="btn-brand-primary group relative w-full flex justify-center py-3 px-4 border border-transparent text-lg font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-transform transform hover:scale-105"
        >
          I am a Customer
        </button>
        <button
          onClick={() => onNavigate(View.SELLER_LOGIN)}
          className="btn-brand-secondary group relative w-full flex justify-center py-3 px-4 text-lg font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-transform transform hover:scale-105"
        >
          I am a Seller
        </button>
      </div>
      <div className="text-sm mt-6">
          <button
              onClick={() => onNavigate(View.USED_CARS)}
              className="font-medium transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}
          >
              Or continue as a guest &rarr;
          </button>
      </div>
       <div className="mt-6 pt-6 border-t border-gray-200-200 dark:border-gray-200-200">
           <div className="text-sm">
              <button
                  onClick={() => onNavigate(View.ADMIN_LOGIN)}
                  className="font-medium text-reride-text dark:text-reride-text transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-orange)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                  Administrator Login
              </button>
          </div>
      </div>
    </div>
  );
};

export default LoginPortal;