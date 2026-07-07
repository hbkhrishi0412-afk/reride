import React, { useCallback, useEffect, useState } from 'react';
import type { ComplaintCase, ComplaintCaseStatus } from '../../types.js';
import { COMPLAINT_CASE_CATEGORIES } from '../../types.js';
import { fetchComplaintCases, updateComplaintCase } from '../../services/complaintCaseService.js';
import { COMPLAINT_CASE_STATUS_COLORS } from '../../utils/complaintDisplay.js';
import { AdminComplaintQueue } from './AdminComplaintQueue.js';

export const AdminComplaintCases: React.FC = () => {
  const [complaints, setComplaints] = useState<ComplaintCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ComplaintCaseStatus>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [resolutionDraft, setResolutionDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = filter === 'all' ? undefined : filter;
      setComplaints(await fetchComplaintCases({ status }));
      setNotesDraft({});
      setResolutionDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load grievances');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdate = useCallback(
    async (complaint: ComplaintCase, status: ComplaintCaseStatus) => {
      setActingId(complaint.id);
      try {
        await updateComplaintCase({
          id: complaint.id,
          status,
          adminNotes: notesDraft[complaint.id],
          resolution: resolutionDraft[complaint.id],
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setActingId(null);
      }
    },
    [load, notesDraft, resolutionDraft],
  );

  return (
    <AdminComplaintQueue
      title="Grievance queue"
      subtitle={(openCount) =>
        `${openCount} open · platform complaints (Consumer Protection workflow)`
      }
      emptyMessage="No grievance cases yet. Users can file via Complaint Resolution when logged in."
      loadingMessage="Loading grievances…"
      filters={['all', 'open', 'investigating', 'resolved', 'escalated']}
      filter={filter}
      onFilterChange={(f) => setFilter(f as typeof filter)}
      categories={COMPLAINT_CASE_CATEGORIES}
      statusColors={COMPLAINT_CASE_STATUS_COLORS}
      openStatuses={['open', 'investigating']}
      items={complaints}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      actingId={actingId}
      notesDraft={notesDraft}
      onNotesChange={(id, value) => setNotesDraft((p) => ({ ...p, [id]: value }))}
      resolutionDraft={resolutionDraft}
      onResolutionChange={(id, value) => setResolutionDraft((p) => ({ ...p, [id]: value }))}
      renderHeaderId={(c) => (
        <span className="font-mono font-bold text-sm text-slate-800">{c.id}</span>
      )}
      renderSubject={(c) => (
        <h3 className="mt-2 font-semibold text-slate-900">{c.subject}</h3>
      )}
      renderMeta={(c) => (
        <p className="mt-2 text-xs text-slate-500">
          {c.reporterName ? `${c.reporterName} · ` : ''}
          {c.reporterEmail}
          {c.dealLeadId ? ` · deal ${c.dealLeadId}` : ''}
          {c.vehicleId ? ` · vehicle ${c.vehicleId}` : ''}
        </p>
      )}
      renderActions={(c) =>
        (['investigating', 'resolved', 'escalated'] as const).map((st) => (
          <button
            key={st}
            type="button"
            disabled={actingId === c.id}
            onClick={() => void handleUpdate(c, st)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white disabled:opacity-50 capitalize"
          >
            Mark {st}
          </button>
        ))
      }
    />
  );
};

export default AdminComplaintCases;
