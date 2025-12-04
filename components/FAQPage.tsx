

import React, { useState, useMemo } from 'react';
import type { FAQItem } from '../types';

interface FAQPageProps {
  faqItems: FAQItem[];
}

const FAQPage: React.FC<FAQPageProps> = ({ faqItems }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openItem, setOpenItem] = useState<number | null>(null);

  // Debug: Log FAQs on mount
  React.useEffect(() => {
    console.log('📋 FAQPage - Received FAQs:', faqItems?.length || 0, faqItems);
  }, [faqItems]);

  const filteredAndGroupedFAQs = useMemo(() => {
    const filtered = faqItems.filter(
      (item) =>
        item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.reduce((acc, item) => {
      const category = item.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, FAQItem[]>);
  }, [faqItems, searchTerm]);

  const toggleItem = (id: number) => {
    setOpenItem(openItem === id ? null : id);
  };

  return (
    <div className="animate-fade-in container mx-auto py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-spinny-text-dark dark:text-spinny-text-dark">
          Frequently Asked Questions
        </h1>
        <p className="mt-4 text-lg text-brand-gray-600 dark:text-spinny-text">
          Find answers to common questions about buying and selling on ReRide.
        </p>
      </div>

      <div className="mb-8">
        <input
          type="search"
          placeholder="Search questions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-4 border border-gray-200-300 dark:border-gray-200-300 rounded-xl focus:outline-none bg-white dark:bg-brand-gray-700 text-lg" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--spinny-orange)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
        />
      </div>

      <div className="space-y-8">
        {Object.entries(filteredAndGroupedFAQs).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-2xl font-bold text-spinny-text-dark dark:text-spinny-text-dark mb-4 border-b border-gray-200-200 dark:border-gray-200-200 pb-2">
              {category}
            </h2>
            <div className="space-y-4">
              {(items as FAQItem[]).map((item) => (
                <div key={item.id} className="border-b border-gray-200-200 dark:border-gray-200-200 last:border-b-0">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full flex justify-between items-center text-left py-4 focus:outline-none"
                    aria-expanded={openItem === item.id}
                  >
                    <span className="text-lg font-semibold text-spinny-text-dark dark:text-spinny-text-dark">
                      {item.question}
                    </span>
                    <svg
                      className={`w-6 h-6 text-spinny-text transition-transform ${
                        openItem === item.id ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openItem === item.id && (
                    <div className="pb-4 text-brand-gray-600 dark:text-spinny-text-dark animate-fade-in">
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(filteredAndGroupedFAQs).length === 0 && (
          <div className="text-center py-10">
            {faqItems.length === 0 ? (
              <div>
                <p className="text-lg text-spinny-text mb-2">No FAQs available yet.</p>
                <p className="text-sm text-gray-500">FAQs will appear here once they are added to the system.</p>
              </div>
            ) : (
              <p className="text-lg text-spinny-text">No questions found matching your search.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FAQPage;
