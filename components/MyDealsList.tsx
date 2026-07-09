import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DealLead, Vehicle } from '../types';
import { dealStageLabel, pipelineStageProgressPercent } from '../types';
import { useMyDealLeads } from '../hooks/useMyDealLeads';
import { EmptyState } from './dashboard/shared';

interface MyDealsListProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onOpenDeal?: (leadId: string, vehicle?: Vehicle) => void;
  onBrowseVehicles?: () => void;
}

function vehicleForLead(vehicles: Vehicle[], lead: DealLead): Vehicle | undefined {
  return vehicles.find(
    (v) => String(v.id) === String(lead.vehicleId) || v.databaseId === String(lead.vehicleId),
  );
}

export const MyDealsList: React.FC<MyDealsListProps> = ({ vehicles, onSelectVehicle, onOpenDeal, onBrowseVehicles }) => {
  const { t } = useTranslation();
  const { activeLeads, loading, error, reload } = useMyDealLeads();

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((n) => (
          <div key={n} className="h-24 rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button type="button" onClick={() => void reload()} className="ml-2 font-semibold underline">
          {t('common.retry', { defaultValue: 'Retry' })}
        </button>
      </div>
    );
  }

  if (!activeLeads.length) {
    return (
      <EmptyState
        icon="🤝"
        title={t('buyerDashboard.deals.emptyTitle', { defaultValue: 'No active deals yet' })}
        description={t('buyerDashboard.deals.emptyBody', {
          defaultValue: 'When you start a tracked deal on a listing, it will appear here with every milestone.',
        })}
        action={
          onBrowseVehicles
            ? {
                label: t('buyerDashboard.deals.browse', { defaultValue: 'Browse vehicles' }),
                onClick: onBrowseVehicles,
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {activeLeads.map((lead) => {
        const vehicle = vehicleForLead(vehicles, lead);
        const title =
          lead.vehicleName ||
          (vehicle ? `${vehicle.make} ${vehicle.model}` : t('buyerDashboard.deals.vehicleFallback', { defaultValue: 'Vehicle' }));
        const progress = pipelineStageProgressPercent(lead.currentStage);
        const canOpenDeal = Boolean(onOpenDeal);

        return (
          <button
            key={lead.id}
            type="button"
            onClick={() => {
              if (onOpenDeal) {
                onOpenDeal(lead.id, vehicle);
                return;
              }
              if (vehicle) onSelectVehicle(vehicle);
            }}
            disabled={!onOpenDeal && !vehicle}
            className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-700">{lead.id}</p>
                <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{dealStageLabel(lead.currentStage)}</p>
              </div>
              {lead.chatStatus === 'pending' ? (
                <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                  {t('buyerDashboard.deals.awaitingSeller', { defaultValue: 'Awaiting seller' })}
                </span>
              ) : null}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {canOpenDeal
                ? t('buyerDashboard.deals.tapForDealRoom', { defaultValue: 'Tap to open deal room' })
                : t('buyerDashboard.deals.tapToOpen', { defaultValue: 'Tap to open listing & deal room' })}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default MyDealsList;
