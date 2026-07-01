import React from 'react';
import { View } from '../types.js';

interface SafetyCenterPageProps {
  onNavigate?: (view: View) => void;
}

interface SafetySection {
  title: string;
  accent: 'blue' | 'teal' | 'red';
  icon: React.ReactNode;
  tips: string[];
}

const accentStyles: Record<SafetySection['accent'], { badge: string; ring: string; dot: string }> = {
  blue: {
    badge: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    ring: 'group-hover:border-blue-300 dark:group-hover:border-blue-500/40',
    dot: 'bg-blue-500',
  },
  teal: {
    badge: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
    ring: 'group-hover:border-teal-300 dark:group-hover:border-teal-500/40',
    dot: 'bg-teal-500',
  },
  red: {
    badge: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    ring: 'group-hover:border-rose-300 dark:group-hover:border-rose-500/40',
    dot: 'bg-rose-500',
  },
};

const sections: SafetySection[] = [
  {
    title: 'Buying a used car',
    accent: 'blue',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
        <circle cx="6.5" cy="16.5" r="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" />
      </svg>
    ),
    tips: [
      'Inspect the vehicle in daylight; check service history, VIN, and RC where possible.',
      'Prefer verified listings and clear photos; ask for an independent inspection if unsure.',
      'Never pay full amounts upfront to strangers; use agreed milestones and documented transfers.',
    ],
  },
  {
    title: 'Selling',
    accent: 'teal',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    tips: [
      'Meet buyers in safe, public places; consider bringing someone with you.',
      'Share accurate condition and paperwork; misrepresentation hurts trust and can cause disputes.',
      'Confirm payment before handing over keys and documents.',
    ],
  },
  {
    title: 'Scams & red flags',
    accent: 'red',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    tips: [
      'Pressure to move off-platform, unusual payment apps, or “shipping only” deals.',
      'Prices far below market with excuses for no inspection or test drive.',
      'Requests for OTPs, passwords, or full card details over chat.',
    ],
  },
];

const SafetyCenterPage: React.FC<SafetyCenterPageProps> = ({ onNavigate }) => {
  return (
    <div className="animate-fade-in container mx-auto py-8 max-w-5xl px-4 pb-24 lg:pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 p-8 md:p-12 shadow-reride-lg">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-blue-500/10" />
        <div className="absolute -right-4 top-20 w-32 h-32 rounded-full bg-blue-400/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-blue-100 ring-1 ring-white/15 backdrop-blur-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Trust &amp; safety
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold text-white">Stay in control, reduce risk</h1>
          <p className="mt-3 max-w-2xl text-slate-300 text-lg">
            Practical tips for buying, selling, and meeting on ReRide — so every deal stays safe and stress-free.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {sections.map((section) => {
          const styles = accentStyles[section.accent];
          return (
            <div
              key={section.title}
              className={`group rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-reride transition-all duration-200 hover:shadow-reride-lg hover:-translate-y-0.5 ${styles.ring}`}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${styles.badge}`}>
                {section.icon}
              </div>
              <h2 className="mt-4 text-xl font-bold text-reride-text-dark dark:text-white">{section.title}</h2>
              <ul className="mt-4 space-y-3">
                {section.tips.map((tip) => (
                  <li key={tip} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${styles.dot}`} />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Need help */}
      <div className="mt-8 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-reride flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-reride-text-dark dark:text-white">Need help?</h2>
            <p className="mt-1 text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
              Report suspicious behaviour from the listing or inbox, or contact Support. For emergencies, contact local
              authorities.
            </p>
          </div>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(View.SUPPORT)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-reride-md hover:bg-blue-700 transition-all flex-shrink-0"
          >
            Contact support
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

export default SafetyCenterPage;
