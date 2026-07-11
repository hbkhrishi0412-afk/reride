import React, { useState } from 'react';
import type { DealLead } from '../../types.js';
import { bookDealInspection } from '../../services/dealService.js';
import { ModalShell } from '../primitives/ModalShell';

export interface MechanicBookingModalProps {
  lead: DealLead;
  onClose: () => void;
  onBooked: (lead: DealLead) => void;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00',
  '14:00', '15:00', '16:00', '17:00',
];

export const MechanicBookingModal: React.FC<MechanicBookingModalProps> = ({
  lead,
  onClose,
  onBooked,
  onNotify,
}) => {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [address, setAddress] = useState(lead.metadata.inspection?.address || '');
  const [notes, setNotes] = useState('');
  const [mechanicName, setMechanicName] = useState('');
  const [loading, setLoading] = useState(false);

  const minDate = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate || !address.trim()) {
      onNotify?.('Please select a date and enter the inspection address.', 'error');
      return;
    }
    setLoading(true);
    try {
      const { lead: updated } = await bookDealInspection({
        leadId: lead.id,
        scheduledDate,
        scheduledTime,
        address: address.trim(),
        notes: notes.trim() || undefined,
        mechanicName: mechanicName.trim() || undefined,
      });
      onNotify?.('Mechanic visit scheduled successfully.', 'success');
      onBooked(updated);
      onClose();
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Booking failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen onClose={onClose} aria-label="Close mechanic booking dialog">
      <div className="bg-white dark:bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-200">
          <h3 className="text-lg font-bold text-slate-900">Book mechanic inspection</h3>
          <p className="text-xs text-slate-500 mt-1 font-mono">{lead.id}</p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Date</label>
            <input
              type="date"
              min={minDate}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-gray-50 dark:border-gray-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Time slot</label>
            <select
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-gray-50 dark:border-gray-200"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Inspection address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="Where should the mechanic inspect the vehicle?"
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none dark:bg-gray-50 dark:border-gray-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Preferred mechanic (optional)</label>
            <input
              type="text"
              value={mechanicName}
              onChange={(e) => setMechanicName(e.target.value)}
              placeholder="Any certified mechanic"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm dark:bg-gray-50 dark:border-gray-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Specific areas to check, access instructions…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none dark:bg-gray-50 dark:border-gray-200"
            />
          </div>
          <div className="flex gap-2 pt-2">
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
              className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-reride-orange text-white disabled:opacity-50"
            >
              {loading ? 'Booking…' : 'Schedule visit'}
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
};

export default MechanicBookingModal;
