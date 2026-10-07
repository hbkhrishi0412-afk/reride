import React from 'react';
import LegalPageShell from './LegalPageShell';
import { legalEntityName, privacyEmail } from '../constants/legalContact';

const deletionMailto = `mailto:${privacyEmail}?subject=${encodeURIComponent(
  'ReRide account deletion request',
)}&body=${encodeURIComponent(
  'Please delete my ReRide account.\n\nRegistered email or phone number: \nName on the account: ',
)}`;

const DeleteAccountPage: React.FC = () => (
  <LegalPageShell title="Delete your ReRide account">
    <section className="mb-8">
      <p className="leading-relaxed">
        You can delete your {legalEntityName} account (website and Android app) at any time. You do not need
        to install the app to make a request.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">1. Delete it yourself (instant)</h2>
      <ol className="list-decimal list-inside space-y-2 ml-4">
        <li>Sign in on the ReRide app or at www.reride.co.in.</li>
        <li>Open <strong>Profile</strong> and scroll to <strong>Data &amp; privacy</strong>.</li>
        <li>Tap <strong>Delete my account</strong> and confirm.</li>
      </ol>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">2. Request deletion by email</h2>
      <p className="leading-relaxed mb-4">
        If you can&apos;t sign in, email{' '}
        <a href={deletionMailto} className="text-blue-600 hover:underline">
          {privacyEmail}
        </a>{' '}
        from the email address on your account (or include the phone number you signed up with). We may ask
        you to confirm ownership before deleting. We complete requests within 30 days.
      </p>
      <a
        href={deletionMailto}
        className="inline-block bg-reride-orange text-white font-semibold px-5 py-3 rounded-lg hover:opacity-90"
      >
        Email a deletion request
      </a>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">3. What we delete</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li>Your profile: name, email, phone number, address, photo and verification documents</li>
        <li>Your sign-in credentials and linked Google / phone login</li>
        <li>Your vehicle listings and the chats attached to them</li>
        <li>Your notifications</li>
      </ul>
    </section>

    <section>
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">4. What we may keep</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li>
          Payment and invoice records, kept for as long as Indian tax and accounting law requires (up to 8
          years)
        </li>
        <li>Records needed to resolve open disputes, prevent fraud or comply with legal requests</li>
        <li>Messages you already sent to other users, which stay in their conversations</li>
      </ul>
      <p className="leading-relaxed mt-4">
        See our{' '}
        <a href="/privacy-policy" className="text-blue-600 hover:underline">
          Privacy Policy
        </a>{' '}
        for details.
      </p>
    </section>
  </LegalPageShell>
);

export default DeleteAccountPage;
