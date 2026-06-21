import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from '../types.js';

interface FooterProps {
    onNavigate: (view: View) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const handleNav = (e: React.MouseEvent, view: View) => {
    e.preventDefault();
    onNavigate(view);
  };
  
  return (
    <footer className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-black overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 right-10 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-gradient-to-tr from-orange-500/5 to-pink-500/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 container mx-auto py-12 mt-16">
        {/* Premium Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="md:col-span-2">
            {/* WHY: footer had no brand anchor; lockup ties the section to the identity. */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-reride-orange to-orange-400 shadow-orange">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0h18m-18 0v4a1 1 0 001 1h1a1 1 0 001-1v-1h10v1a1 1 0 001 1h1a1 1 0 001-1v-4M6.5 16h.01M17.5 16h.01" />
                </svg>
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-white">ReRide</span>
            </div>
            <p className="text-gray-300/90 text-base md:text-lg mb-6 max-w-md leading-relaxed">
              {t('footer.tagline')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 backdrop-blur-sm transition-all duration-300 hover:border-green-400/40 hover:bg-white/10">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-semibold text-white">{t('footer.verifiedPlatform')}</span>
              </div>
              <div className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 backdrop-blur-sm transition-all duration-300 hover:border-blue-400/40 hover:bg-white/10">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-white">{t('footer.securePayments')}</span>
              </div>
              <div className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 backdrop-blur-sm transition-all duration-300 hover:border-orange-400/40 hover:bg-white/10">
                <span className="text-base leading-none" aria-hidden="true">🇮🇳</span>
                <span className="text-sm font-semibold text-white">{t('footer.madeInIndiaBadge', { defaultValue: 'Made in India' })}</span>
              </div>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.quickLinks')}</h3>
            <div className="space-y-3">
              <a href="#" onClick={(e) => handleNav(e, View.USED_CARS)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.buyUsedCars')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.SELL_CAR)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.sellYourCar')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.CAR_SERVICES)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('nav.carServices')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.DEALER_PROFILES)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.dealerNetwork')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.ABOUT_US)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.aboutUs')}
              </a>
            </div>
          </div>
          
          {/* Support */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.support')}</h3>
            <div className="space-y-3">
              <a href="#" onClick={(e) => handleNav(e, View.SUPPORT)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.contactSupport')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.FAQ)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.faq')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.SAFETY_CENTER)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.safety')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.PRIVACY_POLICY)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.privacy')}
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.TERMS_OF_SERVICE)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                {t('footer.terms')}
              </a>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400">
              {t('footer.copyright', { year: new Date().getFullYear() })}
            </p>
            <span className="text-gray-400 text-sm">{t('footer.madeInIndia')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);