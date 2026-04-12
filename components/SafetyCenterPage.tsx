import React from 'react';
import { View } from '../types.js';

interface SafetyCenterPageProps {
  onNavigate?: (view: View) => void;
}

const SafetyCenterPage: React.FC<SafetyCenterPageProps> = ({ onNavigate }) => {
  return (
    <div className="animate-fade-in container mx-auto py-8 max-w-4xl px-4 pb-24 lg:pb-12">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 md:p-12 border border-gray-100 dark:border-gray-700">
        <h1 className="text-4xl md:text-5xl font-extrabold text-reride-text-dark dark:text-white mb-4">
          Trust &amp; safety
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg mb-10">
          Practical tips for buying, selling, and meeting on ReRide — stay in control and reduce risk.
        </p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">Buying a used car</h2>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Inspect the vehicle in daylight; check service history, VIN, and RC where possible.</li>
              <li>Prefer verified listings and clear photos; ask for an independent inspection if unsure.</li>
              <li>Never pay full amounts upfront to strangers; use agreed milestones and documented transfers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">Selling</h2>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Meet buyers in safe, public places; consider bringing someone with you.</li>
              <li>Share accurate condition and paperwork; misrepresentation hurts trust and can cause disputes.</li>
              <li>Confirm payment before handing over keys and documents.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">Scams &amp; red flags</h2>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Pressure to move off-platform, unusual payment apps, or “shipping only” deals.</li>
              <li>Prices far below market with excuses for no inspection or test drive.</li>
              <li>Requests for OTPs, passwords, or full card details over chat.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">Need help?</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Report suspicious behaviour from the listing or inbox, or contact Support. For emergencies, contact local
              authorities.
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(View.SUPPORT)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Contact support
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SafetyCenterPage;
