import React, { useCallback, useEffect, useState } from 'react';
import type { RcQueueItem } from '../../types.js';
import { advanceDealStage, fetchAdminRcQueue } from '../../services/dealService.js';
import { DealDetailPage } from './DealDetailPage.js';
import { useApp } from '../AppProvider.js';
import {
  AdminCardField,
  AdminDesktopTableWrap,
  AdminMobileCard,
  AdminMobileCardList,
} from '../admin/AdminPrimitives.js';

function rcStatusLabel(status: RcQueueItem['rcStatus']): string {
  switch (status) {
    case 'pending_upload':
      return 'Awaiting RC doc';
    case 'submitted':
      return 'RC submitted';
    case 'buyer_confirmed':
      return 'Buyer confirmed';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

function rcStatusColor(status: RcQueueItem['rcStatus']): string {
  switch (status) {
    case 'pending_upload':
      return 'bg-amber-100 text-amber-800';
    case 'submitted':
      return 'bg-blue-100 text-blue-800';
    case 'buyer_confirmed':
      return 'bg-indigo-100 text-indigo-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export const AdminRcQueue: React.FC = () => {
  const { currentUser } = useApp();
  const [queue, setQueue] = useState<RcQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await fetchAdminRcQueue());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRcComplete = useCallback(
    async (item: RcQueueItem) => {
      setActingId(item.id);
      try {
        await advanceDealStage(item.id, 'rc_completed', {}, 'RC transfer marked complete by admin');
        await load();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Action failed');
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

  const pendingCount = queue.filter((q) => q.rcStatus !== 'completed').length;
  const overdueCount = queue.filter((q) => q.daysInQueue > 30 && q.rcStatus !== 'completed').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">RC Transfer Queue</h2>
          <p className="text-sm text-slate-500">
            {pendingCount} pending · {overdueCount} over 30 days
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
        <p className="text-sm text-slate-500 p-8 text-center">Loading RC queue…</p>
      ) : queue.length === 0 ? (
        <p className="text-sm text-slate-500 p-8 text-center border rounded-xl">No deals in RC queue yet.</p>
      ) : (
        <>
        <AdminMobileCardList>
          {queue.map((item) => (
            <AdminMobileCard
              key={item.id}
              highlight={item.daysInQueue > 30 && item.rcStatus !== 'completed' ? 'red' : undefined}
              footer={
                item.rcStatus !== 'completed' ? (
                  <button
                    type="button"
                    disabled={actingId === item.id}
                    onClick={() => void handleMarkRcComplete(item)}
                    className="min-h-[44px] rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"
                  >
                    {actingId === item.id ? '…' : 'Mark RC done'}
                  </button>
                ) : undefined
              }
            >
              <button
                type="button"
                onClick={() => setSelectedLeadId(item.id)}
                className="font-mono text-sm font-bold text-reride-orange hover:underline"
              >
                {item.id}
              </button>
              <div className="mt-3 space-y-1">
                <AdminCardField label="Vehicle">
                  {item.vehicleName || item.metadata.vehicleName || '—'}
                </AdminCardField>
                <AdminCardField label="Buyer">{item.buyerDisplayName || item.buyerEmail}</AdminCardField>
                <AdminCardField label="Seller">{item.sellerDisplayName || item.sellerEmail}</AdminCardField>
                <AdminCardField label="Days in queue">{item.daysInQueue}d</AdminCardField>
                <AdminCardField label="Status">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${rcStatusColor(item.rcStatus)}`}>
                    {rcStatusLabel(item.rcStatus)}
                  </span>
                </AdminCardField>
                <AdminCardField label="Assistance">
                  {item.hasPaidRcAssistance ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      Paid RC assist
                    </span>
                  ) : (
                    '—'
                  )}
                </AdminCardField>
                <AdminCardField label="RC doc">
                  {item.rcDocUrl ? (
                    <a
                      href={item.rcDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-reride-orange hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    '—'
                  )}
                </AdminCardField>
              </div>
            </AdminMobileCard>
          ))}
        </AdminMobileCardList>
        <AdminDesktopTableWrap>
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Deal</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Vehicle</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Buyer</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Seller</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Days</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Assistance</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">RC doc</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {queue.map((item) => (
                <tr key={item.id} className={item.daysInQueue > 30 && item.rcStatus !== 'completed' ? 'bg-red-50/50' : ''}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLeadId(item.id)}
                      className="font-mono font-semibold text-reride-orange hover:underline"
                    >
                      {item.id}
                    </button>
                  </td>
                  <td className="px-4 py-3">{item.vehicleName || item.metadata.vehicleName || '—'}</td>
                  <td className="px-4 py-3">{item.buyerDisplayName || item.buyerEmail}</td>
                  <td className="px-4 py-3">{item.sellerDisplayName || item.sellerEmail}</td>
                  <td className="px-4 py-3 font-semibold">{item.daysInQueue}d</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rcStatusColor(item.rcStatus)}`}>
                      {rcStatusLabel(item.rcStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.hasPaidRcAssistance ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                        Paid RC assist
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.rcDocUrl ? (
                      <a href={item.rcDocUrl} target="_blank" rel="noopener noreferrer" className="text-reride-orange hover:underline text-xs">
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.rcStatus !== 'completed' && (
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => void handleMarkRcComplete(item)}
                        className="text-xs font-bold text-emerald-700 hover:underline disabled:opacity-50"
                      >
                        {actingId === item.id ? '…' : 'Mark RC done'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminDesktopTableWrap>
        </>
      )}
    </div>
  );
};

export default AdminRcQueue;
