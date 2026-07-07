import React from 'react';
import LegalPageShell from './LegalPageShell';
import { grievanceEmail, legalEntityName, supportEmail } from '../constants/legalContact';

const RefundPolicyPage: React.FC = () => (
  <LegalPageShell title="Refund Policy">
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">1. Overview</h2>
      <p className="leading-relaxed mb-4">
        {legalEntityName} (&quot;ReRide&quot;) is a technology platform connecting buyers and sellers of used
        vehicles. This Refund Policy explains when refunds apply to fees paid <em>to ReRide</em>. Vehicle sale
        payments between buyers and sellers are arranged directly between parties — ReRide does not process
        those amounts and cannot issue refunds on vehicle prices.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">2. Seller subscription plans</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li>Subscription fees are <strong>non-refundable</strong> for the current billing period once charged.</li>
        <li>You may cancel anytime; cancellation stops renewal for the next cycle.</li>
        <li>Premium features remain available until the end of the paid period.</li>
        <li>Duplicate charges caused by a technical error on our side will be refunded after verification.</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">3. Deal assistance packages</h2>
      <p className="leading-relaxed mb-4">
        Optional paid services (document review, inspection coordination, RC transfer assistance) are
        processed via our payment partner. Refunds apply only when:
      </p>
      <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
        <li>Service has not commenced within 7 days of purchase, or</li>
        <li>ReRide is unable to deliver the purchased assistance due to platform error.</li>
      </ul>
      <p className="leading-relaxed">
        No refund is provided after document review, coordination, or expert work has started.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">4. Vehicle transactions</h2>
      <p className="leading-relaxed">
        Tokens, full payments, and handover amounts paid directly to another user are outside ReRide&apos;s
        control. Disputes on vehicle condition or payment must be resolved between buyer and seller. Contact
        support if you need guidance or wish to report fraud.
      </p>
    </section>

    <section>
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">5. How to request a refund</h2>
      <p className="leading-relaxed">
        Email{' '}
        <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">
          {supportEmail}
        </a>{' '}
        with your registered email, transaction ID, and reason. For grievances, write to{' '}
        <a href={`mailto:${grievanceEmail}`} className="text-blue-600 hover:underline">
          {grievanceEmail}
        </a>
        . We aim to respond within 7 business days.
      </p>
    </section>
  </LegalPageShell>
);

export default RefundPolicyPage;
