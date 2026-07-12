import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from '../types.js';
import { registeredAddressIndia } from '../constants/legalContact.js';
import { FOOTER_HELP_AND_LEGAL_ITEMS } from '../constants/helpLegalNav.js';
import { WEBSITE_PAGE_GUTTERS } from './WebsitePageShell';

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
      
      <div className={`relative z-10 ${WEBSITE_PAGE_GUTTERS} py-4 sm:py-5 mt-4 sm:mt-5`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-3">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-reride-orange to-orange-400 shadow-orange">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0h18m-18 0v4a1 1 0 001 1h1a1 1 0 001-1v-1h10v1a1 1 0 001 1h1a1 1 0 001-1v-4M6.5 16h.01M17.5 16h.01" />
                </svg>
              </span>
              <span className="text-xl font-extrabold tracking-tight text-white">ReRide</span>
            </div>
            <p className="text-gray-300/90 text-sm mb-3 max-w-md leading-normal">
              {t('footer.tagline')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">
                <span className="text-xs font-semibold text-white">{t('footer.verifiedPlatform')}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">
                <span className="text-xs font-semibold text-white">{t('footer.dealTracking')}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">
                <span className="text-sm leading-none" aria-hidden="true">🇮🇳</span>
                <span className="text-xs font-semibold text-white">{t('footer.madeInIndiaBadge', { defaultValue: 'Made in India' })}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-bold text-base mb-2">{t('footer.platform', { defaultValue: 'Platform' })}</h3>
            <div className="space-y-1.5">
              <NavButton view={View.USED_CARS}>{t('footer.buyUsedCars')}</NavButton>
              <NavButton view={View.SELL_CAR}>{t('footer.sellYourCar')}</NavButton>
              <NavButton view={View.SAFETY_CENTER}>{t('footer.howDealsWork', { defaultValue: 'How deals work' })}</NavButton>
              <NavButton view={View.DEALER_PROFILES}>{t('footer.dealerNetwork')}</NavButton>
              <NavButton view={View.CAR_SERVICES}>{t('nav.carServices')}</NavButton>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-base mb-2">{t('footer.helpAndLegal', { defaultValue: 'Help & legal' })}</h3>
            <div className="space-y-1.5">
              {FOOTER_HELP_AND_LEGAL_ITEMS.map((item) => (
                <NavButton key={item.view} view={item.view}>
                  {t(item.labelKey, { defaultValue: item.defaultLabel })}
                </NavButton>
              ))}
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-700 pt-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
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
