import React, { useCallback, useEffect, useState } from 'react';
import type { DealRevenueDashboard } from '../../types.js';
import { fetchAdminDealRevenue } from '../../services/dealService.js';
import {
  AdminCardField,
  AdminDesktopTableWrap,
  AdminMobileCard,
  AdminMobileCardList,
} from '../admin/AdminPrimitives.js';

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export const AdminDealRevenue: React.FC = () => {
  const [dashboard, setDashboard] = useState<DealRevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDashboard(await fetchAdminDealRevenue());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500 p-8 text-center">Loading deal revenue…</p>;
  }

  if (!dashboard) {
    return <p className="text-sm text-red-600 p-8 text-center">Could not load revenue data.</p>;
  }

  const { stats, funnel, packageBreakdown, recentPayments } = dashboard;
  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Deal Revenue & Analytics</h2>
          <p className="text-sm text-slate-500">Pipeline funnel, assistance revenue, and deal metrics</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total leads', value: stats.totalLeads, color: 'text-slate-900' },
          { label: 'Completed deals', value: stats.completedDeals, color: 'text-emerald-600' },
          { label: 'Conversion rate', value: `${stats.conversionRate}%`, color: 'text-blue-600' },
          { label: 'Assistance revenue', value: formatInr(stats.assistanceRevenue), color: 'text-reride-orange' },
          { label: 'Active deals', value: stats.activeDeals, color: 'text-indigo-600' },
          { label: 'Cancelled', value: stats.cancelledDeals, color: 'text-red-600' },
          { label: 'Assistance purchases', value: stats.assistancePurchases, color: 'text-purple-600' },
          { label: 'Avg accepted offer', value: stats.avgDealValue > 0 ? formatInr(stats.avgDealValue) : '—', color: 'text-teal-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Deal funnel</h3>
          <div className="space-y-2">
            {funnel.map((step) => (
              <div key={step.stage} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-32 shrink-0 capitalize">{step.label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-reride-orange rounded-full transition-all"
                    style={{ width: `${Math.max(4, (step.count / maxFunnel) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700 w-8 text-right">{step.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Assistance packages</h3>
          {packageBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">No assistance purchases yet.</p>
          ) : (
            <ul className="space-y-2">
              {packageBreakdown.map((pkg) => (
                <li key={pkg.packageId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{pkg.label}</span>
                  <span className="font-semibold text-slate-900">
                    {pkg.count} × {formatInr(pkg.revenue / Math.max(pkg.count, 1))} = {formatInr(pkg.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Recent assistance payments</h3>
        </div>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">No payments recorded yet.</p>
        ) : (
          <>
          <AdminMobileCardList>
            {recentPayments.map((p) => (
              <AdminMobileCard key={`${p.leadId}-${p.paidAt}-mobile`}>
                <p className="font-mono text-sm font-bold text-reride-orange">{p.leadId}</p>
                <div className="mt-3 space-y-1">
                  <AdminCardField label="Package">{p.packageId}</AdminCardField>
                  <AdminCardField label="Amount">{formatInr(p.amount)}</AdminCardField>
                  <AdminCardField label="Paid">
                    {new Date(p.paidAt).toLocaleString('en-IN')}
                  </AdminCardField>
                </div>
              </AdminMobileCard>
            ))}
          </AdminMobileCardList>
          <AdminDesktopTableWrap>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Deal</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Package</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentPayments.map((p) => (
                  <tr key={`${p.leadId}-${p.paidAt}`}>
                    <td className="px-4 py-2 font-mono text-reride-orange">{p.leadId}</td>
                    <td className="px-4 py-2">{p.packageId}</td>
                    <td className="px-4 py-2 font-semibold">{formatInr(p.amount)}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">
                      {new Date(p.paidAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDesktopTableWrap>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDealRevenue;
