import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FraudDashboard, FraudSignal } from '../../types.js';
import { fetchAdminFraudDashboard } from '../../services/dealService.js';

function severityStyles(severity: FraudSignal['severity']): string {
  switch (severity) {
    case 'high':
      return 'border-red-200 bg-red-50';
    case 'medium':
      return 'border-amber-200 bg-amber-50';
    default:
      return 'border-slate-200 bg-slate-50';
  }
}

function severityBadge(severity: FraudSignal['severity']): string {
  switch (severity) {
    case 'high':
      return 'bg-red-600 text-white';
    case 'medium':
      return 'bg-amber-500 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
}

function typeLabel(type: FraudSignal['type']): string {
  switch (type) {
    case 'content_report':
      return 'Report';
    case 'cancelled_deal':
      return 'Cancelled';
    case 'repeat_buyer':
      return 'Repeat buyer';
    case 'stale_chat':
      return 'Stale chat';
    case 'low_trust_seller':
      return 'Low trust';
    default:
      return type;
  }
}

export const AdminFraudDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<FraudDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDashboard(await fetchAdminFraudDashboard());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSignals = useMemo(() => {
    if (!dashboard) return [];
    if (filter === 'all') return dashboard.signals;
    return dashboard.signals.filter((s) => s.severity === filter);
  }, [dashboard, filter]);

  const stats = dashboard?.stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Fraud & Risk Dashboard</h2>
          <p className="text-sm text-slate-500">Aggregated signals from reports, deals, and user patterns</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
        >
          Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'High risk', value: stats.highRisk, color: 'text-red-600' },
            { label: 'Medium risk', value: stats.mediumRisk, color: 'text-amber-600' },
            { label: 'Reports', value: stats.pendingReports, color: 'text-blue-600' },
            { label: 'Cancelled deals', value: stats.cancelledDeals, color: 'text-slate-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'high', 'medium', 'low'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f === 'all' ? 'All signals' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 p-8 text-center">Loading risk signals…</p>
      ) : filteredSignals.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-sm font-semibold text-emerald-800">No matching signals</p>
          <p className="text-xs text-emerald-700 mt-1">The pipeline looks clean for this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSignals.map((signal) => (
            <div
              key={signal.id}
              className={`rounded-xl border p-4 ${severityStyles(signal.severity)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${severityBadge(signal.severity)}`}>
                    {signal.severity}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-600 border border-slate-200">
                    {typeLabel(signal.type)}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{signal.title}</h3>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(signal.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-2">{signal.description}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                {signal.targetEmail && <span>User: {signal.targetEmail}</span>}
                {signal.dealId && <span className="font-mono text-reride-orange">{signal.dealId}</span>}
                {signal.targetType && signal.targetId && (
                  <span>{signal.targetType}: {signal.targetId}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFraudDashboard;
