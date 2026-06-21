import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Vehicle } from '../types';
import {
  fetchAdminBuyerInspections,
  type AdminBuyerInspectionRow,
} from '../services/adminVehicleFeedbackService';
import {
  AdminContentFrame,
  AdminDataTableFrame,
  AdminEmptyState,
  AdminPageIntro,
  AdminToolbar,
  adminTableHeadClass,
} from './admin/AdminPrimitives';

interface AdminVehicleFeedbackProps {
  vehicles: Vehicle[];
  embedded?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveVehicleLabel(vehicleId: string, vehicles: Vehicle[]): string {
  const match = vehicles.find(
    (v) =>
      String(v.databaseId || '') === vehicleId ||
      String(v.id) === vehicleId,
  );
  if (!match) return `Vehicle ${vehicleId.slice(0, 8)}…`;
  return `${match.year} ${match.make} ${match.model}`.trim();
}

const AdminVehicleFeedback: React.FC<AdminVehicleFeedbackProps> = ({
  vehicles,
  embedded = true,
}) => {
  const [inspections, setInspections] = useState<AdminBuyerInspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchAdminBuyerInspections({
        page,
        limit: 15,
        search: search || undefined,
        flaggedOnly,
      });
      setInspections(result.inspections);
      setTotalPages(Math.max(1, result.pagination?.pages || 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer feedback');
      setInspections([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, flaggedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const flaggedCount = useMemo(
    () => inspections.filter((row) => row.flaggedKeys.length > 0).length,
    [inspections],
  );

  return (
    <AdminContentFrame>
      {embedded ? (
        <AdminPageIntro
          eyebrow="Marketplace"
          title="Customer vehicle feedback"
          description="Buyer verification checklists submitted against listings. Review flagged discrepancies vs seller disclosure."
        />
      ) : null}

      <AdminToolbar
        left={
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search buyer email, vehicle id, seller…"
              className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => {
                  setFlaggedOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              Flagged only
            </label>
          </>
        }
        right={
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <AdminDataTableFrame
        title="Buyer verification submissions"
        subtitle={
          loading
            ? 'Loading…'
            : `${inspections.length} on this page${flaggedCount ? ` · ${flaggedCount} with flags` : ''}`
        }
      >
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          </div>
        ) : inspections.length === 0 ? (
          <AdminEmptyState
            title="No customer feedback yet"
            description="When buyers save a verification checklist on a vehicle listing, it will appear here."
          />
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className={adminTableHeadClass}>
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inspections.map((row) => {
                const isOpen = expandedId === row.id;
                const vehicleLabel = resolveVehicleLabel(row.vehicleId, vehicles);
                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{vehicleLabel}</td>
                      <td className="px-4 py-3 text-slate-700">{row.buyerEmail}</td>
                      <td className="px-4 py-3 text-slate-600">{row.sellerEmail || '—'}</td>
                      <td className="px-4 py-3">
                        {row.flaggedKeys.length > 0 ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            {row.flaggedKeys.length} flagged
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : row.id)}
                          className="text-sm font-semibold text-violet-600 hover:text-violet-800"
                        >
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50/90 px-4 py-4">
                          {row.generalNotes ? (
                            <p className="mb-3 text-sm text-slate-700">
                              <span className="font-semibold">Notes:</span> {row.generalNotes}
                            </p>
                          ) : null}
                          {row.disclosureReason ? (
                            <p className="mb-3 text-sm text-amber-800">
                              <span className="font-semibold">Disclosure flag:</span>{' '}
                              {row.disclosureReason}
                            </p>
                          ) : null}
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-100 text-slate-600">
                                <tr>
                                  <th className="px-3 py-2 text-left">Checklist item</th>
                                  <th className="px-3 py-2 text-left">Status</th>
                                  <th className="px-3 py-2 text-left">Buyer notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {row.items
                                  .filter((item) => item.status)
                                  .map((item) => (
                                    <tr
                                      key={item.id}
                                      className={
                                        row.flaggedKeys.includes(item.id)
                                          ? 'bg-amber-50/60'
                                          : undefined
                                      }
                                    >
                                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                        {item.id}
                                      </td>
                                      <td className="px-3 py-2 uppercase font-semibold text-slate-800">
                                        {item.status}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {item.notes || '—'}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </AdminDataTableFrame>
    </AdminContentFrame>
  );
};

export default AdminVehicleFeedback;
