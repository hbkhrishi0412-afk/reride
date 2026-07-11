/**
 * Modal to mark vehicle sold and initiate verified transaction with buyer.
 */
import React, { useMemo, useState } from 'react';
import type { Conversation } from '../types';
import { initiateTrustDeal } from '../services/vehicleTrustService';
import { ModalShell } from './primitives/ModalShell';

interface MarkSoldDealModalProps {
  vehicleId: number | string;
  vehicleTitle: string;
  conversations: Conversation[];
  sellerEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const MarkSoldDealModal: React.FC<MarkSoldDealModalProps> = ({
  vehicleId,
  vehicleTitle,
  conversations,
  sellerEmail,
  onClose,
  onSuccess,
}) => {
  const normalizedSeller = sellerEmail.toLowerCase().trim();
  const buyerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      const buyer = c.customerId || (c as Conversation & { customerEmail?: string }).customerEmail;
      if (!buyer) continue;
      const email = buyer.toLowerCase().trim();
      if (email === normalizedSeller) continue;
      const label = c.customerName || email;
      map.set(email, label);
    }
    return Array.from(map.entries()).map(([email, label]) => ({ email, label }));
  }, [conversations, normalizedSeller]);

  const [buyerEmail, setBuyerEmail] = useState(buyerOptions[0]?.email || '');
  const [manualEmail, setManualEmail] = useState('');
  const [useManual, setUseManual] = useState(buyerOptions.length === 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const effectiveEmail = useManual ? manualEmail.trim().toLowerCase() : buyerEmail;

  const handleSubmit = async () => {
    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      setError('Enter a valid buyer email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await initiateTrustDeal(vehicleId, effectiveEmail);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen onClose={onClose} aria-label="Close mark as sold dialog">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Mark as sold</h3>
        <p className="text-sm text-gray-600 mt-1">
          Link <strong>{vehicleTitle}</strong> to the buyer for verified ratings.
        </p>

        {buyerOptions.length > 0 && (
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-700">Buyer from your chats</label>
            <select
              value={useManual ? '' : buyerEmail}
              disabled={useManual}
              onChange={(e) => setBuyerEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            >
              {buyerOptions.map((o) => (
                <option key={o.email} value={o.email}>{o.label} ({o.email})</option>
              ))}
            </select>
            <button
              type="button"
              className="text-xs text-reride-orange mt-1 underline"
              onClick={() => setUseManual(!useManual)}
            >
              {useManual ? 'Pick from chats' : 'Enter email manually'}
            </button>
          </div>
        )}

        {(useManual || buyerOptions.length === 0) && (
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-700">Buyer email</label>
            <input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="buyer@email.com"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-reride-orange text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Confirm sale'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default MarkSoldDealModal;
