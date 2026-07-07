import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DealKanbanStatus, DealLead } from '../../types.js';
import { DEAL_KANBAN_COLUMNS, dealKanbanLabel } from '../../types.js';
import {
  fetchAdminDealLeads,
  fetchAdminKanban,
  updateDealKanbanStatus,
} from '../../services/dealService.js';
import { DealDetailPage } from './DealDetailPage.js';
import { useApp } from '../AppProvider.js';
import {
  AdminCardField,
  AdminDesktopTableWrap,
  AdminMobileCard,
  AdminMobileCardList,
} from '../admin/AdminPrimitives.js';

type ViewMode = 'kanban' | 'table';

function leadSearchText(lead: DealLead): string {
  return [
    lead.id,
    lead.buyerDisplayName,
    lead.buyerName,
    lead.buyerEmail,
    lead.sellerDisplayName,
    lead.sellerEmail,
    lead.vehicleName,
    lead.metadata.vehicleName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function KanbanCard({
  lead,
  onSelect,
}: {
  lead: DealLead;
  onSelect: (lead: DealLead) => void;
}) {
  const buyer = lead.buyerDisplayName || lead.buyerName || 'Buyer';
  const vehicle = lead.vehicleName || lead.metadata.vehicleName || 'Vehicle';

  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-reride-orange/40 hover:shadow-sm transition-all"
    >
      <p className="text-[10px] font-mono font-bold text-reride-orange">{lead.id}</p>
      <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">{buyer}</p>
      <p className="text-xs text-slate-500 truncate">{vehicle}</p>
      {lead.metadata.acceptedOfferAmount && (
        <p className="text-xs font-semibold text-emerald-700 mt-1">
          ₹{lead.metadata.acceptedOfferAmount.toLocaleString('en-IN')}
        </p>
      )}
      {lead.assignedAdminEmail && (
        <p className="text-[10px] text-slate-400 mt-1 truncate">→ {lead.assignedAdminEmail}</p>
      )}
    </button>
  );
}

export const AdminDealCenter: React.FC = () => {
  const { currentUser } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [board, setBoard] = useState<Record<DealKanbanStatus, DealLead[]> | null>(null);
  const [tableLeads, setTableLeads] = useState<DealLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmptyKanbanColumns, setShowEmptyKanbanColumns] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [kanbanBoard, leads] = await Promise.all([
        fetchAdminKanban(),
        fetchAdminDealLeads(),
      ]);
      setBoard(kanbanBoard.columns);
      setTableLeads(leads);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load deal center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalCount = useMemo(() => {
    if (!board) return tableLeads.length;
    return Object.values(board).reduce((sum, arr) => sum + arr.length, 0);
  }, [board, tableLeads]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const matchesSearch = useCallback(
    (lead: DealLead) => !normalizedSearch || leadSearchText(lead).includes(normalizedSearch),
    [normalizedSearch],
  );

  const filteredTableLeads = useMemo(
    () => tableLeads.filter(matchesSearch),
    [tableLeads, matchesSearch],
  );

  const visibleKanbanColumns = useMemo(() => {
    if (!board) return DEAL_KANBAN_COLUMNS;
    if (showEmptyKanbanColumns) return DEAL_KANBAN_COLUMNS;
    return DEAL_KANBAN_COLUMNS.filter((col) => {
      const cards = (board[col.status] || []).filter(matchesSearch);
      return cards.length > 0;
    });
  }, [board, showEmptyKanbanColumns, matchesSearch]);

  const activeStageSummary = useMemo(() => {
    if (!board) return [];
    return DEAL_KANBAN_COLUMNS.map((col) => ({
      ...col,
      count: (board[col.status] || []).filter(matchesSearch).length,
    })).filter((col) => col.count > 0);
  }, [board, matchesSearch]);

  const handleMove = useCallback(
    async (leadId: string, kanbanStatus: DealKanbanStatus) => {
        setMovingId(leadId);
      try {
        await updateDealKanbanStatus(leadId, kanbanStatus, currentUser?.email);
        await load();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Move failed');
      } finally {
        setMovingId(null);
      }
    },
    [currentUser?.email, load],
  );

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-sm font-semibold text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

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
        onNotify={(msg, type) => {
          if (type === 'error') setLoadError(msg);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Deal Center</h2>
          <p className="text-sm text-slate-500">{totalCount} deals in pipeline</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead ID, buyer, vehicle…"
            className="w-56 px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
          />
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-sm font-semibold ${
                viewMode === 'kanban' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-semibold ${
                viewMode === 'table' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
              }`}
            >
              Table
            </button>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      {!loading && activeStageSummary.length > 1 && viewMode === 'kanban' && (
        <p className="text-xs text-slate-500">
          Deals are spread across {activeStageSummary.length} stages — scroll the board or use Table view to see all.
          {' '}
          {activeStageSummary.map((col) => `${col.label} (${col.count})`).join(' · ')}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 p-8 text-center">Loading deal center…</p>
      ) : viewMode === 'kanban' && board ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs text-slate-500">
              Showing {visibleKanbanColumns.length} of {DEAL_KANBAN_COLUMNS.length} columns
            </p>
            <button
              type="button"
              onClick={() => setShowEmptyKanbanColumns((v) => !v)}
              className="text-xs font-semibold text-reride-orange hover:underline"
            >
              {showEmptyKanbanColumns ? 'Hide empty columns' : 'Show all columns'}
            </button>
          </div>
          <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-3 min-w-max">
            {visibleKanbanColumns.map((col) => {
              const cards = (board[col.status] || []).filter(matchesSearch);
              return (
                <div
                  key={col.status}
                  className="w-64 shrink-0 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col max-h-[70vh]"
                >
                  <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.color}`}>
                      {col.label}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">{cards.length}</span>
                  </div>
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {cards.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">Empty</p>
                    ) : (
                      cards.map((lead) => (
                        <KanbanCard key={lead.id} lead={lead} onSelect={(l) => setSelectedLeadId(l.id)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      ) : (
        <>
        <AdminMobileCardList>
          {filteredTableLeads.map((lead) => (
            <AdminMobileCard key={`${lead.id}-mobile`}>
              <button
                type="button"
                onClick={() => setSelectedLeadId(lead.id)}
                className="font-mono text-sm font-bold text-reride-orange hover:underline"
              >
                {lead.id}
              </button>
              <div className="mt-3 space-y-1">
                <AdminCardField label="Buyer">{lead.buyerDisplayName || lead.buyerEmail}</AdminCardField>
                <AdminCardField label="Seller">{lead.sellerDisplayName || lead.sellerEmail}</AdminCardField>
                <AdminCardField label="Vehicle">
                  {lead.vehicleName || lead.metadata.vehicleName || '—'}
                </AdminCardField>
                <AdminCardField label="Stage">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                    {dealKanbanLabel(lead.kanbanStatus || 'lead_created')}
                  </span>
                </AdminCardField>
                <AdminCardField label="Updated">
                  {new Date(lead.updatedAt).toLocaleDateString('en-IN')}
                </AdminCardField>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-500">Move to</label>
                <select
                  disabled={movingId === lead.id}
                  value={lead.kanbanStatus || 'lead_created'}
                  onChange={(e) => void handleMove(lead.id, e.target.value as DealKanbanStatus)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {DEAL_KANBAN_COLUMNS.map((c) => (
                    <option key={c.status} value={c.status}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </AdminMobileCard>
          ))}
        </AdminMobileCardList>
        {filteredTableLeads.length === 0 && (
          <p className="text-sm text-slate-500 p-8 text-center lg:hidden">
            {tableLeads.length === 0 ? 'No deal leads yet.' : 'No deals match your search.'}
          </p>
        )}
        <AdminDesktopTableWrap>
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Lead ID</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Buyer</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Seller</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Vehicle</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Kanban</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Move to</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTableLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="font-mono font-semibold text-reride-orange hover:underline"
                    >
                      {lead.id}
                    </button>
                  </td>
                  <td className="px-4 py-3">{lead.buyerDisplayName || lead.buyerEmail}</td>
                  <td className="px-4 py-3">{lead.sellerDisplayName || lead.sellerEmail}</td>
                  <td className="px-4 py-3">{lead.vehicleName || lead.metadata.vehicleName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                      {dealKanbanLabel(lead.kanbanStatus || 'lead_created')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={movingId === lead.id}
                      value={lead.kanbanStatus || 'lead_created'}
                      onChange={(e) => void handleMove(lead.id, e.target.value as DealKanbanStatus)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                    >
                      {DEAL_KANBAN_COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(lead.updatedAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTableLeads.length === 0 && (
            <p className="text-sm text-slate-500 p-8 text-center hidden lg:block">
              {tableLeads.length === 0 ? 'No deal leads yet.' : 'No deals match your search.'}
            </p>
          )}
        </AdminDesktopTableWrap>
        </>
      )}
    </div>
  );
};

export default AdminDealCenter;
