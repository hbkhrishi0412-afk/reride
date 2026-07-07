import React from 'react';
import { View } from '../types';
import LegalPageShell from './LegalPageShell';
import { grievanceEmail, legalEntityName } from '../constants/legalContact';

interface FraudPolicyPageProps {
  onNavigate?: (view: View) => void;
}

const FraudPolicyPage: React.FC<FraudPolicyPageProps> = ({ onNavigate }) => (
  <LegalPageShell title="Fraud Policy">
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">1. Commitment</h2>
      <p className="leading-relaxed">
        {legalEntityName} is committed to reducing fraud on ReRide. Users who post false information, steal
        identities, or attempt to defraud others may have accounts suspended and be reported to authorities.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">2. Prohibited conduct</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li>Listing vehicles you do not own or have authority to sell</li>
        <li>Using stolen, forged, or altered RC and identity documents</li>
        <li>Duplicate or bait listings with intent to mislead</li>
        <li>Requesting advance payment before inspection without disclosure</li>
        <li>Pressuring users to move off-platform to avoid moderation</li>
        <li>Phishing for OTPs, passwords, or full card details</li>
        <li>Impersonating ReRide staff or partners</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">3. Red flags for buyers & sellers</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li>Price far below market with refusal to meet or inspect</li>
        <li>&quot;Shipping only&quot; or overseas seller excuses for Indian listings</li>
        <li>Urgent pressure to pay token to unknown UPI IDs</li>
        <li>RC details that do not match the physical vehicle or Parivahan records</li>
        <li>Seller unwilling to use ReRide chat or deal checklist</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">4. Reporting & enforcement</h2>
      <p className="leading-relaxed mb-4">
        Use the <strong>Report listing</strong> option on any vehicle page or{' '}
        {onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate(View.SAFETY_CENTER)}
            className="text-blue-600 hover:underline font-medium"
          >
            Trust &amp; Safety
          </button>
        ) : (
          'Trust & Safety'
        )}{' '}
        for guidance. Email{' '}
        <a href={`mailto:${grievanceEmail}`} className="text-blue-600 hover:underline">
          {grievanceEmail}
        </a>{' '}
        for formal complaints.
      </p>
      <p className="leading-relaxed">
        We may remove listings, freeze accounts, and preserve logs for law enforcement. For criminal fraud,
        file a complaint with your local cybercrime cell or dial national helplines as applicable.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">5. Limitation</h2>
      <p className="leading-relaxed">
        ReRide cannot recover money paid outside the platform or guarantee that every user acts honestly.
        Always verify documents independently, inspect in person, and use the deal room to document milestones.
      </p>
    </section>
  </LegalPageShell>
);

export default FraudPolicyPage;
