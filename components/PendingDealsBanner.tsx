/**
 * Banner for buyers to confirm pending purchases and unlock ratings.
 */
import React, { useEffect, useState } from 'react';
import type { Vehicle, VehicleTrustDeal } from '../types';
import { confirmTrustDeal, fetchPendingDeals } from '../services/vehicleTrustService';
import { useApp } from './AppProvider';

interface PendingDealsBannerProps {
  vehicles: Vehicle[];
  onConfirmed?: () => void;
}

export const PendingDealsBanner: React.FC<PendingDealsBannerProps> = ({ vehicles, onConfirmed }) => {
  const { addToast } = useApp();
  const [deals, setDeals] = useState<VehicleTrustDeal[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    void fetchPendingDeals().then(setDeals).catch(() => setDeals([]));
  }, []);

  if (!deals.length) return null;

  const vehicleTitle = (vehicleId: string) => {
    const v = vehicles.find(
      (x) => String(x.id) === vehicleId || x.databaseId === vehicleId,
    );
    return v ? `${v.make} ${v.model}` : 'Vehicle';
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
      <h4 className="font-bold text-amber-900 text-sm">Confirm your purchase</h4>
      <p className="text-xs text-amber-800 mt-1">
        Sellers marked these as sold to you. Confirm to unlock mutual ratings.
      </p>
      <ul className="mt-3 space-y-2">
        {deals.map((deal) => (
          <li key={deal.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border">
            <span className="text-sm font-medium text-gray-900">{vehicleTitle(deal.vehicleId)}</span>
            <button
              type="button"
              disabled={confirming === deal.id}
              onClick={async () => {
                setConfirming(deal.id);
                try {
                  await confirmTrustDeal(deal.id);
                  setDeals((d) => d.filter((x) => x.id !== deal.id));
                  onConfirmed?.();
                } catch {
                  addToast('Could not confirm — try again', 'error');
                } finally {
                  setConfirming(null);
                }
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white disabled:opacity-50"
            >
              {confirming === deal.id ? '…' : 'I bought this'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PendingDealsBanner;
