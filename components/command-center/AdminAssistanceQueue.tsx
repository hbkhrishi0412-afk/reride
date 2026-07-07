import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AssistanceFulfillmentStatus, AssistanceQueueItem } from '../../types.js';
import { ASSISTANCE_FULFILLMENT_STATUSES } from '../../types.js';
import {
  fetchAdminAssistanceQueue,
  updateAssistanceFulfillment,
} from '../../services/dealService.js';
import { DealDetailPage } from './DealDetailPage.js';
import { useApp } from '../AppProvider.js';

function statusColor(status: AssistanceFulfillmentStatus): string {
  switch (status) {
    case 'requested':
      return 'bg-amber-100 text-amber-800';
    case 'assigned':
      return 'bg-blue-100 text-blue-800';
    case 'in_progress':
      return 'bg-indigo-100 text-indigo-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatInr(amount?: number): string {
  if (!amount) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export const AdminAssistanceQueue: React.FC = () => {
  const { currentUser } = useApp();
  const [searchParams] = useSearchParams();
  const [queue, setQueue] = useState<AssistanceQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await fetchAdminAssistanceQueue());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const pendingLead =
        searchParams.get('leadId') ||
        sessionStorage.getItem('reride_admin_assistance_lead');
      if (pendingLead) {
        sessionStorage.removeItem('reride_admin_assistance_lead');
        setSelectedLeadId(pendingLead);
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  const handleStatusChange = useCallback(
    async (item: AssistanceQueueItem, status: AssistanceFulfillmentStatus) => {
      setActingId(item.id);
      try {
        await updateAssistanceFulfillment({ leadId: item.id, status });
        await load();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setActingId(null);
      }
    },
    [load],
  );

  const handleAssignToMe = useCallback(
    async (item: AssistanceQueueItem) => {
      setActingId(item.id);
      try {
        await updateAssistanceFulfillment({ leadId: item.id, assignToMe: true });
        await load();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Assign failed');
      } finally {
        setActingId(null);
      }
    },
    [load],
  );

  if (selectedLeadId && currentUser) {
    return (
      <DealDetailPage
        leadId={selectedLeadId}
        currentUser={currentUser}
        role="admin"
        onBack={() => {
          setSelectedLeadId(null);
          void load();
        }}
      />
    );
  }

  const openCount = queue.filter((q) => !['completed', 'cancelled'].includes(q.fulfillmentStatus)).length;
  const needsAction = queue.filter(
    (q) => q.fulfillmentStatus === 'requested' || q.fulfillmentStatus === 'assigned',
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Assistance Queue</h2>
          <p className="text-sm text-slate-500">
            {openCount} open requests · {needsAction} awaiting action
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 p-8 text-center">Loading assistance queue…</p>
      ) : queue.length === 0 ? (
        <p className="text-sm text-slate-500 p-8 text-center border rounded-xl">
          No open assistance requests.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Deal</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Package</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Paid</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Days</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Assigned</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {queue.map((item) => (
                <tr
                  key={item.id}
                  className={item.daysOpen > 3 && item.fulfillmentStatus === 'requested' ? 'bg-amber-50/50' : ''}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLeadId(item.id)}
                      className="font-mono font-semibold text-reride-orange hover:underline"
                    >
                      {item.id}
                    </button>
                    <p className="text-xs text-slate-500 truncate max-w-[140px]">
                      {item.vehicleName || item.metadata.vehicleName || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{item.packageLabel}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.needsInspectionBooking && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">
                          Inspection
                        </span>
                      )}
                      {item.needsRcAssistance && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">
                          RC
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{item.source}</td>
                  <td className="px-4 py-3 font-semibold">{formatInr(item.paidAmount)}</td>
                  <td className="px-4 py-3 font-semibold">{item.daysOpen}d</td>
                  <td className="px-4 py-3">
                    <select
                      disabled={actingId === item.id}
                      value={item.fulfillmentStatus}
                      onChange={(e) =>
                        void handleStatusChange(item, e.target.value as AssistanceFulfillmentStatus)
                      }
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 ${statusColor(item.fulfillmentStatus)}`}
                    >
                      {ASSISTANCE_FULFILLMENT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[120px]">
                    {item.metadata.assistanceFulfillment?.assignedAdminEmail || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {!item.metadata.assistanceFulfillment?.assignedAdminEmail && (
                        <button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void handleAssignToMe(item)}
                          className="text-xs font-bold text-blue-700 hover:underline disabled:opacity-50 text-left"
                        >
                          Assign to me
                        </button>
                      )}
                      {item.fulfillmentStatus !== 'completed' && (
                        <button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void handleStatusChange(item, 'completed')}
                          className="text-xs font-bold text-emerald-700 hover:underline disabled:opacity-50 text-left"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAssistanceQueue;
