import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FAQItem } from '../types.js';
import { View } from '../types.js';
import { DEFAULT_PLATFORM_FAQS } from '../constants/defaultFaqs.js';
import WebsitePageShell from './WebsitePageShell';

const HELP_CATEGORIES = [
  { id: 'all', labelKey: 'help.category.all', defaultLabel: 'All topics' },
  { id: 'Deals & RC', labelKey: 'help.category.deals', defaultLabel: 'Deals & RC' },
  { id: 'Buying', labelKey: 'help.category.buying', defaultLabel: 'Buying' },
  { id: 'Selling', labelKey: 'help.category.selling', defaultLabel: 'Selling' },
  { id: 'Account', labelKey: 'help.category.account', defaultLabel: 'Account' },
  { id: 'Subscriptions', labelKey: 'help.category.subscriptions', defaultLabel: 'Subscriptions' },
  { id: 'Safety', labelKey: 'help.category.safety', defaultLabel: 'Safety' },
] as const;

interface HelpCenterPageProps {
  faqItems: FAQItem[];
  onNavigate?: (view: View) => void;
}

const HelpCenterPage: React.FC<HelpCenterPageProps> = ({ faqItems, onNavigate }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [openId, setOpenId] = useState<number | null>(null);

  const items = useMemo(() => {
    const source = faqItems.length > 0 ? faqItems : DEFAULT_PLATFORM_FAQS;
    const q = search.trim().toLowerCase();
    return source.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      );
    });
  }, [faqItems, search, category]);

  const grouped = useMemo(() => {
    return items.reduce((acc, item) => {
      const cat = item.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, FAQItem[]>);
  }, [items]);

  return (
    <WebsitePageShell narrow="4xl">
      <div className="text-center mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-reride-text-dark break-words">
          {t('help.title', { defaultValue: 'Help Center' })}
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          {t('help.subtitle', {
            defaultValue:
              'Guides for buying, selling, deal rooms, RC transfer, and account settings on ReRide.',
          })}
        </p>
      </div>

      <input
        type="search"
        placeholder={t('help.searchPlaceholder', { defaultValue: 'Search help articles…' })}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 sm:p-4 border border-gray-300 rounded-xl focus:outline-none bg-white text-base sm:text-lg mb-4 min-h-[44px]"
      />

      <div className="flex flex-wrap gap-2 mb-8">
        {HELP_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold border transition-colors ${
              category === cat.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            {t(cat.labelKey, { defaultValue: cat.defaultLabel })}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {Object.entries(grouped).map(([cat, catItems]) => (
          <section key={cat}>
            <h2 className="text-xl font-bold text-reride-text-dark mb-4 border-b pb-2">{cat}</h2>
            <div className="space-y-3">
              {catItems.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === item.id ? null : item.id)}
                    className="w-full flex justify-between items-center text-left px-4 py-3 min-h-[44px] hover:bg-gray-50"
                    aria-expanded={openId === item.id}
                  >
                    <span className="font-semibold text-gray-900 pr-4 break-words">{item.question}</span>
                    <svg
                      className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                        openId === item.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openId === item.id && (
                    <div className="px-4 pb-4 text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        {items.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            {t('help.noResults', { defaultValue: 'No articles match your search. Try another term or contact support.' })}
          </p>
        )}
      </div>

      {onNavigate && (
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavigate(View.SUPPORT)}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className="font-bold text-gray-900">{t('help.card.support.title', { defaultValue: 'Contact support' })}</div>
            <p className="mt-1 text-sm text-gray-600">{t('help.card.support.desc', { defaultValue: 'Open a ticket for account or listing issues.' })}</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate(View.COMPLAINT_RESOLUTION)}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className="font-bold text-gray-900">{t('help.card.grievance.title', { defaultValue: 'File a grievance' })}</div>
            <p className="mt-1 text-sm text-gray-600">{t('help.card.grievance.desc', { defaultValue: 'Formal complaint resolution process.' })}</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate(View.SAFETY_CENTER)}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className="font-bold text-gray-900">{t('help.card.safety.title', { defaultValue: 'Trust & safety' })}</div>
            <p className="mt-1 text-sm text-gray-600">{t('help.card.safety.desc', { defaultValue: 'Tips for safe buying, selling, and RC transfer.' })}</p>
          </button>
        </div>
      )}
    </WebsitePageShell>
  );
};

export default HelpCenterPage;
