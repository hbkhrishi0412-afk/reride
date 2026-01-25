import React, { useState } from 'react';

interface ForgotPasswordProps {
  onResetRequest: (email: string) => void;
  onBack: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onResetRequest, onBack }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onResetRequest(email);
    setSubmitted(true);
  };
  
  const formInputClass = "appearance-none relative block w-full px-4 py-3 border border-gray-200-300 dark:border-gray-200-300 placeholder-brand-gray-500 text-reride-text-dark dark:text-brand-gray-200 bg-white focus:outline-none focus:z-10 sm:text-sm";


  return (
    <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-reride-text-dark dark:text-reride-text-dark">
          Forgot Your Password?
        </h2>
        <p className="mt-2 text-center text-sm text-brand-gray-600 dark:text-reride-text">
          No problem. Enter your email address below and we'll send you instructions to reset it.
        </p>
      </div>
      
      {submitted ? (
          <div className="text-center p-4 bg-reride-orange-light dark:bg-reride-orange/50 text-reride-orange dark:text-reride-orange rounded-lg">
              <p>If an account with your email exists, password reset instructions have been sent. Please check your inbox.</p>
          </div>
      ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm">
              <div>
                <label htmlFor="email-address" className="sr-only">Email address</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`${formInputClass} rounded-md`}
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white btn-brand-primary focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
              >
                Send Reset Link
              </button>
            </div>
          </form>
      )}

      <div className="text-sm text-center">
        <button onClick={onBack} className="font-medium transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>
          &larr; Back to Login
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;