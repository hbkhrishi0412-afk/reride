import React, { useCallback, useEffect, useState } from 'react';
import type { DealComplaint, DealComplaintStatus } from '../../types.js';
import { DEAL_COMPLAINT_CATEGORIES } from '../../types.js';
import { fetchDealComplaints, updateDealComplaint } from '../../services/dealService.js';
import { DEAL_COMPLAINT_STATUS_COLORS } from '../../utils/complaintDisplay.js';
import { DealDetailPage } from './DealDetailPage.js';
import { AdminComplaintQueue } from './AdminComplaintQueue.js';
import { useApp } from '../AppProvider.js';

export const AdminDealComplaints: React.FC = () => {
  const { currentUser } = useApp();
  const [complaints, setComplaints] = useState<DealComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | DealComplaintStatus>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = filter === 'all' ? undefined : filter;
      setComplaints(await fetchDealComplaints({ status }));
      setNotesDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load complaints');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdate = useCallback(
    async (complaint: DealComplaint, status: DealComplaintStatus) => {
      setActingId(complaint.id);
      try {
        await updateDealComplaint({
          complaintId: complaint.id,
          status,
          adminNotes: notesDraft[complaint.id],
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setActingId(null);
      }
    },
    [load, notesDraft],
  );

  if (selectedLeadId && currentUser) {
    return (
      <DealDetailPage
        leadId={selectedLeadId}
        currentUser={currentUser}
        role="admin"
        onBack={() => setSelectedLeadId(null)}
      />
    );
  }

  return (
    <AdminComplaintQueue
      title="Deal Complaints"
      subtitle={(openCount) => `${openCount} open · linked to RR-LD deals`}
      emptyMessage="No complaints found."
      loadingMessage="Loading complaints…"
      filters={['all', 'open', 'investigating', 'resolved', 'dismissed']}
      filter={filter}
      onFilterChange={(f) => setFilter(f as typeof filter)}
      categories={DEAL_COMPLAINT_CATEGORIES}
      statusColors={DEAL_COMPLAINT_STATUS_COLORS}
      openStatuses={['open', 'investigating']}
      items={complaints}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      actingId={actingId}
      notesDraft={notesDraft}
      onNotesChange={(id, value) => setNotesDraft((prev) => ({ ...prev, [id]: value }))}
      renderHeaderId={(c) => (
        <button
          type="button"
          onClick={() => setSelectedLeadId(c.leadId)}
          className="font-mono font-bold text-reride-orange hover:underline text-sm"
        >
          {c.leadId}
        </button>
      )}
      renderMeta={(c) => (
        <p className="text-xs text-slate-500 mt-1">
          Reported by {c.reporterEmail}
          {c.dealVehicleName && ` · ${c.dealVehicleName}`}
        </p>
      )}
      renderActions={(c) =>
        c.status !== 'resolved' && c.status !== 'dismissed' ? (
          <>
            {c.status === 'open' && (
              <button
                type="button"
                disabled={actingId === c.id}
                onClick={() => void handleUpdate(c, 'investigating')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-100 text-amber-800 disabled:opacity-50"
              >
                Investigate
              </button>
            )}
            <button
              type="button"
              disabled={actingId === c.id}
              onClick={() => void handleUpdate(c, 'resolved')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-green-100 text-green-800 disabled:opacity-50"
            >
              Resolve
            </button>
            <button
              type="button"
              disabled={actingId === c.id}
              onClick={() => void handleUpdate(c, 'dismissed')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 disabled:opacity-50"
            >
              Dismiss
            </button>
          </>
        ) : null
      }
    />
  );
};

export default AdminDealComplaints;
