import React from 'react';
import { complaintCategoryLabel, complaintStatusColor } from '../../utils/complaintDisplay.js';

export interface AdminComplaintQueueItem {
  id: string;
  status: string;
  category: string;
  message: string;
  createdAt: string;
  reporterEmail?: string;
  reporterName?: string;
  subject?: string;
  adminNotes?: string;
  resolution?: string;
}

interface AdminComplaintQueueProps<T extends AdminComplaintQueueItem> {
  title: string;
  subtitle: (openCount: number) => string;
  emptyMessage: string;
  loadingMessage: string;
  filters: readonly string[];
  filter: string;
  onFilterChange: (filter: string) => void;
  categories: readonly { value: string; label: string }[];
  statusColors: Record<string, string>;
  openStatuses: readonly string[];
  items: T[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  actingId: string | null;
  notesDraft: Record<string, string>;
  onNotesChange: (id: string, value: string) => void;
  resolutionDraft?: Record<string, string>;
  onResolutionChange?: (id: string, value: string) => void;
  renderHeaderId: (item: T) => React.ReactNode;
  renderMeta?: (item: T) => React.ReactNode;
  renderSubject?: (item: T) => React.ReactNode;
  renderActions: (item: T) => React.ReactNode;
}

export function AdminComplaintQueue<T extends AdminComplaintQueueItem>({
  title,
  subtitle,
  emptyMessage,
  loadingMessage,
  filters,
  filter,
  onFilterChange,
  categories,
  statusColors,
  openStatuses,
  items,
  loading,
  error,
  onRefresh,
  actingId,
  notesDraft,
  onNotesChange,
  resolutionDraft,
  onResolutionChange,
  renderHeaderId,
  renderMeta,
  renderSubject,
  renderActions,
}: AdminComplaintQueueProps<T>) {
  const openCount = items.filter((c) => openStatuses.includes(c.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle(openCount)}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={onRefresh} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 p-8 text-center">{loadingMessage}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 p-8 text-center border rounded-xl">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {renderHeaderId(item)}
                  <span
                    className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${complaintStatusColor(item.status, statusColors)}`}
                  >
                    {item.status}
                  </span>
                  <span className="ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {complaintCategoryLabel(categories, item.category)}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              {renderSubject?.(item)}
              <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{item.message}</p>
              {renderMeta?.(item)}
              <textarea
                className="mt-3 w-full text-sm border rounded-lg p-2 resize-none"
                rows={2}
                placeholder="Admin notes (internal)"
                value={notesDraft[item.id] ?? item.adminNotes ?? ''}
                onChange={(e) => onNotesChange(item.id, e.target.value)}
              />
              {onResolutionChange ? (
                <textarea
                  className="mt-2 w-full text-sm border rounded-lg p-2 resize-none"
                  rows={2}
                  placeholder="Resolution message to reporter"
                  value={resolutionDraft?.[item.id] ?? item.resolution ?? ''}
                  onChange={(e) => onResolutionChange(item.id, e.target.value)}
                />
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">{renderActions(item)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminComplaintQueue;
