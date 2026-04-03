import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ForgotPasswordProps {
  onResetRequest: (email: string) => void;
  onBack: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onResetRequest, onBack }) => {
  const { t } = useTranslation();
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
          {t('auth.forgotTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-brand-gray-600 dark:text-reride-text">
          {t('auth.forgotIntro')}
        </p>
      </div>
      
      {submitted ? (
          <div className="text-center p-4 bg-reride-orange-light dark:bg-reride-orange/50 text-reride-orange dark:text-reride-orange rounded-lg">
              <p>{t('auth.forgotSent')}</p>
          </div>
      ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm">
              <div>
                <label htmlFor="email-address" className="sr-only">{t('auth.emailAddress')}</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`${formInputClass} rounded-md`}
                  placeholder={t('auth.placeholder.email')}
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
                {t('auth.sendResetLink')}
              </button>
            </div>
          </form>
      )}

      <div className="text-sm text-center">
        <button type="button" onClick={onBack} className="font-medium transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>
          &larr; {t('auth.backToLogin')}
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;