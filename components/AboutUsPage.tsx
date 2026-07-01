import React from 'react';
import { formatSupportPhoneDisplay, supportTelHref } from '../utils/whatsappShare.js';
import { View } from '../types.js';

interface AboutUsPageProps {
  onNavigate?: (view: View) => void;
}

const features: { title: string; description: string; icon: React.ReactNode }[] = [
  {
    title: 'Focused experience',
    description: 'Browse, compare, chat, and book service without the clutter.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    title: 'Built for India',
    description: 'Local cities, ₹ pricing, and support channels people actually use.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: 'Trust-first',
    description: 'We invest in verification, safety tips, and clear policies.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
];

const stats: { label: string; value: string }[] = [
  { label: 'India-first', value: '100%' },
  { label: 'Buy • Sell • Service', value: '3-in-1' },
  { label: 'Verified workshops', value: 'Marketplace' },
];

const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate }) => {
  const supportTel = supportTelHref();
  return (
    <div className="animate-fade-in container mx-auto py-8 max-w-5xl px-4 pb-24 lg:pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 p-8 md:p-12 shadow-reride-lg">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-blue-500/10" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 rounded-full bg-blue-400/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-blue-100 ring-1 ring-white/15 backdrop-blur-sm">
            About ReRide
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold text-white">
            Used cars &amp; car care, made simple
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300 text-lg">
            A simple, India-first platform that connects buyers, sellers, and verified workshops — all in one place.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-6 text-center shadow-reride"
          >
            <div className="text-xl md:text-3xl font-extrabold text-blue-600 dark:text-blue-400">{stat.value}</div>
            <div className="mt-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* What we do */}
      <div className="mt-8 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-reride">
        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">What we do</h2>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
          ReRide helps buyers discover quality used vehicles and connects them with sellers and dealers. We also offer{' '}
          <strong className="text-reride-text-dark dark:text-white">car services</strong> as a marketplace: you book with
          confidence, and verified workshops fulfil the work. We are the platform between customers and providers—not the
          workshop ourselves.
        </p>
      </div>

      {/* Why ReRide */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-4">Why ReRide</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-reride transition-all duration-200 hover:shadow-reride-lg hover:-translate-y-0.5"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-reride-text-dark dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="mt-8 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-reride flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-reride-text-dark dark:text-white">Contact</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
            {supportTel ? (
              <>
                Questions or partnership enquiries? Reach us through Support or call{' '}
                <a href={supportTel} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  {formatSupportPhoneDisplay()}
                </a>
                .
              </>
            ) : (
              <>Questions or partnership enquiries? Reach us through Support.</>
            )}
          </p>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(View.SUPPORT)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-reride-md hover:bg-blue-700 transition-all flex-shrink-0"
          >
            Go to Support
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default AboutUsPage;
