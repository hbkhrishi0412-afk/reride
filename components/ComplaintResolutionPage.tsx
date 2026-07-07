import React, { useState } from 'react';
import { View, COMPLAINT_CASE_CATEGORIES } from '../types';
import LegalPageShell from './LegalPageShell';
import { grievanceEmail, legalEntityName, registeredAddressIndia, supportEmail } from '../constants/legalContact';
import { useApp } from './AppProvider';
import { createComplaintCase } from '../services/complaintCaseService';

interface ComplaintResolutionPageProps {
  onNavigate?: (view: View) => void;
}

const ComplaintResolutionPage: React.FC<ComplaintResolutionPageProps> = ({ onNavigate }) => {
  const { currentUser, addToast } = useApp();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(COMPLAINT_CASE_CATEGORIES[0].value);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email) {
      addToast('Please sign in to file a formal grievance.', 'error');
      onNavigate?.(View.LOGIN_PORTAL);
      return;
    }
    setSubmitting(true);
    try {
      await createComplaintCase({
        subject: subject.trim(),
        message: message.trim(),
        category,
        reporterName: currentUser.name,
      });
      addToast('Grievance submitted. We will acknowledge within 7 business days.', 'success');
      setSubject('');
      setMessage('');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not submit grievance', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
  <LegalPageShell title="Complaint Resolution">
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">1. Our role</h2>
      <p className="leading-relaxed">
        {legalEntityName} operates ReRide as an intermediary technology platform. We help buyers and sellers
        discover vehicles, communicate, and track deal milestones. We are not the seller of listed vehicles
        unless explicitly stated. Complaints about vehicle condition or price are primarily between the
        transacting parties; we facilitate moderation, documentation review, and account actions where
        policies are violated.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">2. How to raise a complaint</h2>
      <ol className="list-decimal list-inside space-y-2 ml-4">
        <li>
          Submit via{' '}
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate(View.SUPPORT)}
              className="text-blue-600 hover:underline font-medium"
            >
              Contact Support
            </button>
          ) : (
            'Contact Support'
          )}{' '}
          with listing ID, deal reference (if any), and evidence.
        </li>
        <li>
          Email <a href={`mailto:${grievanceEmail}`} className="text-blue-600 hover:underline">{grievanceEmail}</a>{' '}
          for formal grievances under applicable consumer protection norms.
        </li>
        <li>Use the grievance form below when signed in (creates a tracked case).</li>
      </ol>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">3. Timelines</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li><strong>Acknowledgment:</strong> within 7 business days of receipt</li>
        <li><strong>Investigation:</strong> listing review, on-platform chat logs, party statements</li>
        <li><strong>Target resolution:</strong> clear next step within 30 days for standard complaints</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">4. Possible outcomes</h2>
      <ul className="list-disc list-inside space-y-2 ml-4">
        <li>Warning or education notice to a user</li>
        <li>Listing removal or account suspension for policy violations</li>
        <li>Guidance to consumer forum or cybercrime authorities for fraud</li>
        <li>No liability for vehicle condition disputes between private parties</li>
      </ul>
    </section>

    <section className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <h2 className="text-xl font-bold text-reride-text-dark mb-4">File a formal grievance</h2>
      {!currentUser ? (
        <p className="text-gray-600 text-sm">
          <button
            type="button"
            onClick={() => onNavigate?.(View.LOGIN_PORTAL)}
            className="text-blue-600 font-semibold hover:underline"
          >
            Sign in
          </button>{' '}
          to submit a tracked grievance case, or email {grievanceEmail}.
        </p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full border rounded-lg p-2.5"
            >
              {COMPLAINT_CASE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-lg p-2.5"
              placeholder="Brief summary of your grievance"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Details</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded-lg p-2.5"
              placeholder="Include listing ID, deal reference, dates, and what outcome you need"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit grievance'}
          </button>
        </form>
      )}
    </section>

    <section>
      <h2 className="text-2xl font-bold text-reride-text-dark mb-4">5. Contact</h2>
      <p className="leading-relaxed">
        Grievance officer: <a href={`mailto:${grievanceEmail}`} className="text-blue-600 hover:underline">{grievanceEmail}</a>
        <br />
        Support: <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">{supportEmail}</a>
        <br />
        Registered office: {registeredAddressIndia}
      </p>
    </section>
  </LegalPageShell>
  );
};

export default ComplaintResolutionPage;
