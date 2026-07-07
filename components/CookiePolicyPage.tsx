import React from 'react';
import LegalPageShell from './LegalPageShell';
import { legalEntityName, privacyEmail } from '../constants/legalContact';

const CookiePolicyPage: React.FC = () => (
  <LegalPageShell title="Cookie Policy">
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">1. What are cookies?</h2>
      <p className="leading-relaxed">
        Cookies are small text files stored on your device when you visit {legalEntityName}&apos;s website or
        app. They help us remember preferences, keep you signed in, and understand how the Service is used.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">2. Cookies we use</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li><strong>Essential:</strong> authentication, security, session management, cookie consent choice</li>
        <li><strong>Functional:</strong> language preference, location selection, recently viewed listings</li>
        <li><strong>Analytics:</strong> aggregated usage via Google Analytics (only if you accept cookies)</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">3. Your choices</h2>
      <p className="leading-relaxed mb-4">
        When you first visit, you can <strong>Accept</strong> or <strong>Decline</strong> non-essential
        cookies via our banner. You can also clear cookies in your browser settings. Declining analytics
        cookies does not block core marketplace features.
      </p>
      <p className="leading-relaxed">
        For more on how we use personal data, see our{' '}
        <a href="/privacy-policy" className="text-blue-600 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">4. Third-party cookies</h2>
      <p className="leading-relaxed">
        Payment partners (e.g. Razorpay) and sign-in providers (e.g. Google) may set their own cookies when
        you use those features. Their use is governed by their respective policies.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">5. Contact</h2>
      <p className="leading-relaxed">
        Questions about cookies:{' '}
        <a href={`mailto:${privacyEmail}`} className="text-blue-600 hover:underline">
          {privacyEmail}
        </a>
      </p>
    </section>
  </LegalPageShell>
);

export default CookiePolicyPage;
