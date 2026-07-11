import React, { useState } from 'react';
import type { DealComplaintCategory } from '../../types.js';
import { DEAL_COMPLAINT_CATEGORIES } from '../../types.js';
import { createDealComplaint } from '../../services/dealService.js';
import { ModalShell } from '../primitives/ModalShell';

export interface DealComplaintModalProps {
  leadId: string;
  onClose: () => void;
  onSubmitted?: () => void;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

export const DealComplaintModal: React.FC<DealComplaintModalProps> = ({
  leadId,
  onClose,
  onSubmitted,
  onNotify,
}) => {
  const [category, setCategory] = useState<DealComplaintCategory>('other');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      onNotify?.('Please describe the issue.', 'error');
      return;
    }
    setLoading(true);
    try {
      await createDealComplaint({ leadId, category, message: message.trim() });
      onNotify?.('Complaint submitted. Our team will review it.', 'success');
      onSubmitted?.();
      onClose();
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Could not submit complaint', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen onClose={onClose} aria-label="Close complaint dialog">
      <div className="bg-white dark:bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-200">
          <h3 className="text-lg font-bold text-slate-900">Report an issue</h3>
          <p className="text-xs text-slate-500 mt-1">
            Linked to deal <span className="font-mono text-reride-orange">{leadId}</span>
          </p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DealComplaintCategory)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-gray-50 dark:border-gray-200"
            >
              {DEAL_COMPLAINT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Describe the issue</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="What went wrong? Include dates, amounts, or document issues if relevant."
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none dark:bg-gray-50 dark:border-gray-200"
            />
          </div>
          <p className="text-[10px] text-slate-400">
            Complaints are reviewed by ReRide ops and linked to this deal for resolution.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit complaint'}
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
};

export default DealComplaintModal;
