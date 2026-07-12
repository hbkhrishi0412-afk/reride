import React from 'react';
import WebsitePageShell from './WebsitePageShell';
import { formatSupportPhoneDisplay, supportTelHref } from '../utils/whatsappShare.js';
import { View } from '../types.js';
import AutoT from './AutoT';
import { useAutoT } from '../hooks/useAutoT';
import { useTranslation } from 'react-i18next';

interface AboutUsPageProps {
  onNavigate?: (view: View) => void;
}

const FEATURE_KEYS = [
  { titleKey: 'about.feature1.title', descKey: 'about.feature1.desc', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )},
  { titleKey: 'about.feature2.title', descKey: 'about.feature2.desc', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )},
  { titleKey: 'about.feature3.title', descKey: 'about.feature3.desc', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )},
] as const;

const STAT_KEYS = [
  { labelKey: 'about.stat1.label', value: 'India' },
  { labelKey: 'about.stat2.label', value: 'Deal → RC' },
  { labelKey: 'about.stat3.label', value: 'Free list' },
] as const;

function FeatureCard({ titleKey, descKey, icon }: { titleKey: string; descKey: string; icon: React.ReactNode }) {
  const title = useAutoT(titleKey);
  const desc = useAutoT(descKey);
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-reride transition-all duration-200 hover:shadow-reride-lg hover:-translate-y-0.5">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-bold text-reride-text-dark dark:text-white" data-no-translate>{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed" data-no-translate>{desc}</p>
    </div>
  );
}

const DEAL_STEP_KEYS = [
  { titleKey: 'home.testimonials.amitName', descKey: 'home.testimonials.amitQuote', tagKey: 'home.testimonials.amitTag' },
  { titleKey: 'home.testimonials.riyaName', descKey: 'home.testimonials.riyaQuote', tagKey: 'home.testimonials.riyaTag' },
  { titleKey: 'home.testimonials.karanName', descKey: 'home.testimonials.karanQuote', tagKey: 'home.testimonials.karanTag' },
] as const;

const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const supportTel = supportTelHref();
  const whatWeDoBody = useAutoT('about.whatWeDo.body');

  return (
    <WebsitePageShell narrow="5xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 p-4 sm:p-8 md:p-12 shadow-reride-lg">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-blue-500/10" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 rounded-full bg-blue-400/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-blue-100 ring-1 ring-white/15 backdrop-blur-sm">
            <AutoT i18nKey="about.badge" />
          </span>
          <h1 className="mt-4 text-2xl sm:text-3xl md:text-5xl font-extrabold text-white break-words">
            <AutoT i18nKey="about.hero.title" as="span" />
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300 text-lg">
            <AutoT i18nKey="about.hero.subtitle" as="span" />
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {STAT_KEYS.map((stat) => (
          <div
            key={stat.labelKey}
            className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-6 text-center shadow-reride"
          >
            <div className="text-xl md:text-3xl font-extrabold text-blue-600 dark:text-blue-400">{stat.value}</div>
            <div className="mt-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
              <AutoT i18nKey={stat.labelKey} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-8 md:p-10 shadow-reride">
        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">
          <AutoT i18nKey="about.whatWeDo.title" />
        </h2>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg" data-no-translate>
          {whatWeDoBody}
        </p>
      </div>

      <div id="how-deals-work" className="mt-8 scroll-mt-24">
        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-2">
          <AutoT i18nKey="about.howDeals.title" />
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          <AutoT i18nKey="about.howDeals.subtitle" as="span" />
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {DEAL_STEP_KEYS.map((step, idx) => (
            <div
              key={step.titleKey}
              className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-reride"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">
                    <AutoT i18nKey={step.titleKey} />
                  </div>
                  <div className="text-xs text-blue-700 font-medium">
                    <AutoT i18nKey={step.tagKey} />
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                <AutoT i18nKey={step.descKey} as="span" />
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50/80 dark:bg-amber-500/10 dark:border-amber-500/20 p-4 sm:p-8">
        <h2 className="text-xl font-bold text-reride-text-dark dark:text-white mb-2">
          <AutoT i18nKey="about.notWe.title" />
        </h2>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          <AutoT i18nKey="about.notWe.body" as="span" />
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-4">
          <AutoT i18nKey="about.why.title" />
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURE_KEYS.map((f) => (
            <FeatureCard key={f.titleKey} titleKey={f.titleKey} descKey={f.descKey} icon={f.icon} />
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-8 shadow-reride flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-reride-text-dark dark:text-white">
            <AutoT i18nKey="about.contact.title" />
          </h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
            {supportTel ? (
              <>
                <AutoT i18nKey="about.contact.body" options={{ phone: formatSupportPhoneDisplay() }} as="span" />
              </>
            ) : (
              <AutoT i18nKey="about.contact.bodyNoPhone" as="span" />
            )}
          </p>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(View.SUPPORT)}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold shadow-reride-md hover:bg-blue-700 transition-all flex-shrink-0"
          >
            <AutoT i18nKey="about.contact.cta" />
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </div>
    </WebsitePageShell>
  );
};

export default AboutUsPage;
