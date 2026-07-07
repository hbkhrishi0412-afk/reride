import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from '../types.js';
import { registeredAddressIndia } from '../constants/legalContact.js';

interface FooterProps {
    onNavigate: (view: View) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const linkClass =
    'block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform text-left';

  const NavButton: React.FC<{ view: View; children: React.ReactNode }> = ({ view, children }) => (
    <button type="button" onClick={() => onNavigate(view)} className={linkClass}>
      {children}
    </button>
  );

  return (
    <footer className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-black overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 right-10 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-gradient-to-tr from-orange-500/5 to-pink-500/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-10 sm:py-12 mt-12 sm:mt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-reride-orange to-orange-400 shadow-orange">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0h18m-18 0v4a1 1 0 001 1h1a1 1 0 001-1v-1h10v1a1 1 0 001 1h1a1 1 0 001-1v-4M6.5 16h.01M17.5 16h.01" />
                </svg>
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-white">ReRide</span>
            </div>
            <p className="text-gray-300/90 text-sm md:text-base mb-6 max-w-md leading-relaxed">
              {t('footer.tagline')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                <span className="text-sm font-semibold text-white">{t('footer.verifiedPlatform')}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                <span className="text-sm font-semibold text-white">{t('footer.dealTracking')}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                <span className="text-base leading-none" aria-hidden="true">🇮🇳</span>
                <span className="text-sm font-semibold text-white">{t('footer.madeInIndiaBadge', { defaultValue: 'Made in India' })}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.platform', { defaultValue: 'Platform' })}</h3>
            <div className="space-y-3">
              <NavButton view={View.USED_CARS}>{t('footer.buyUsedCars')}</NavButton>
              <NavButton view={View.SELL_CAR}>{t('footer.sellYourCar')}</NavButton>
              <NavButton view={View.ABOUT_US}>{t('footer.howDealsWork', { defaultValue: 'How deals work' })}</NavButton>
              <NavButton view={View.DEALER_PROFILES}>{t('footer.dealerNetwork')}</NavButton>
              <NavButton view={View.CAR_SERVICES}>{t('nav.carServices')}</NavButton>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.trustLegal', { defaultValue: 'Trust & legal' })}</h3>
            <div className="space-y-3">
              <NavButton view={View.SAFETY_CENTER}>{t('footer.safety')}</NavButton>
              <NavButton view={View.FRAUD_POLICY}>{t('footer.fraud', { defaultValue: 'Fraud Policy' })}</NavButton>
              <NavButton view={View.COMPLAINT_RESOLUTION}>{t('footer.complaint', { defaultValue: 'Complaint Resolution' })}</NavButton>
              <NavButton view={View.PRIVACY_POLICY}>{t('footer.privacy')}</NavButton>
              <NavButton view={View.TERMS_OF_SERVICE}>{t('footer.terms')}</NavButton>
              <NavButton view={View.REFUND_POLICY}>{t('footer.refund', { defaultValue: 'Refund Policy' })}</NavButton>
              <NavButton view={View.COOKIE_POLICY}>{t('footer.cookies', { defaultValue: 'Cookie Policy' })}</NavButton>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.support')}</h3>
            <div className="space-y-3">
              <NavButton view={View.HELP_CENTER}>{t('footer.helpCenter', { defaultValue: 'Help center' })}</NavButton>
              <NavButton view={View.SUPPORT}>{t('footer.contactSupport')}</NavButton>
              <NavButton view={View.FAQ}>{t('footer.faq')}</NavButton>
              <NavButton view={View.ABOUT_US}>{t('footer.aboutUs')}</NavButton>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-gray-400">{t('footer.copyright', { year: new Date().getFullYear() })}</p>
              <p className="text-gray-500 text-xs mt-1 max-w-xl">{registeredAddressIndia}</p>
            </div>
            <span className="text-gray-400 text-sm">{t('footer.madeInIndia')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);
