import React from 'react';
import { View } from '../types.js';

interface AboutUsPageProps {
  onNavigate?: (view: View) => void;
}

const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate }) => {
  return (
    <div className="animate-fade-in container mx-auto py-8 max-w-4xl px-4 pb-24 lg:pb-12">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 md:p-12 border border-gray-100 dark:border-gray-700">
        <h1 className="text-4xl md:text-5xl font-extrabold text-reride-text-dark dark:text-white mb-4">
          About ReRide
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg mb-10">
          A simple, India-first platform for used cars and car care.
        </p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">What we do</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              ReRide helps buyers discover quality used vehicles and connects them with sellers and dealers. We also offer{' '}
              <strong>car services</strong> as a marketplace: you book with confidence, and verified workshops fulfil the work.
              We are the platform between customers and providers—not the workshop ourselves.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">Why ReRide</h2>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Focused experience — browse, compare, chat, and book service without clutter.</li>
              <li>Built for India — cities, ₹ pricing, and local support channels.</li>
              <li>Trust-first — we invest in verification, safety tips, and clear policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-reride-text-dark dark:text-white mb-3">Contact</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Questions or partnership enquiries? Reach us through Support or call{' '}
              <a href="tel:+917277277275" className="text-blue-600 font-semibold hover:underline">
                +91 72772 77275
              </a>
              .
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(View.SUPPORT)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Go to Support
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AboutUsPage;
