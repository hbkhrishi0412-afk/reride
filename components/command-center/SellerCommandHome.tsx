import React, { useCallback, useEffect, useState } from 'react';
import type { Conversation, User } from '../../types.js';
import { dealStageLabel, type DealLead, type SellerCommandCenter, type SellerTask } from '../../types.js';
import {
  acceptDealChat,
  advanceDealStage,
  fetchSellerCommandCenter,
} from '../../services/dealService.js';
import SellerDealCalendar from './SellerDealCalendar.js';

export interface SellerCommandHomeProps {
  seller: User;
  conversations: Conversation[];
  compact?: boolean;
  onOpenConversation?: (conversation: Conversation) => void;
  onOpenDeal?: (leadId: string) => void;
  onNavigateToMessages?: () => void;
  onNavigateToListings?: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onSignInAgain?: () => void;
}

function taskActionLabel(type: SellerTask['type']): string {
  switch (type) {
    case 'accept_chat':
      return 'Accept';
    case 'respond_offer':
      return 'Open chat';
    case 'confirm_test_drive':
      return 'View';
    case 'confirm_token':
      return 'Confirm';
    case 'confirm_delivery':
      return 'Confirm';
    default:
      return 'Open';
  }
}

function taskPriorityDot(priority: number): string {
  if (priority >= 90) return 'bg-red-500';
  if (priority >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export const SellerCommandHome: React.FC<SellerCommandHomeProps> = ({
  seller,
  conversations,
  compact = false,
  onOpenConversation,
  onOpenDeal,
  onNavigateToMessages,
  onNavigateToListings,
  onNotify,
  onSignInAgain,
}) => {
  const [data, setData] = useState<SellerCommandCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { rehydrateApiCredentials } = await import('../../utils/validatePersistedSession.js');
      await rehydrateApiCredentials();
      const center = await fetchSellerCommandCenter();
      setData(center);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Could not load command center';
      const message =
        /authentication required/i.test(raw)
          ? 'Your session is missing API credentials. Please log out and sign in again.'
          : raw;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDealConversation = useCallback(
    (task: SellerTask) => {
      if (!task.conversationId) {
        onNavigateToMessages?.();
        return;
      }
      const conv = conversations.find((c) => String(c.id) === String(task.conversationId));
      if (conv && onOpenConversation) {
        onOpenConversation(conv);
      } else {
        onNavigateToMessages?.();
      }
    },
    [conversations, onOpenConversation, onNavigateToMessages],
  );

  const handleTaskAction = useCallback(
    async (task: SellerTask) => {
      setActingId(task.id);
      try {
        if (task.type === 'accept_chat') {
          await acceptDealChat(task.dealId, task.conversationId);
          onNotify?.('Chat accepted — buyer can message you now.', 'success');
          await load();
          openDealConversation(task);
          return;
        }
        if (task.type === 'confirm_token') {
          await advanceDealStage(task.dealId, 'token_confirmed');
          onNotify?.('Token confirmed.', 'success');
          await load();
          return;
        }
        if (task.type === 'confirm_delivery') {
          await advanceDealStage(task.dealId, 'delivery_pending');
          onNotify?.('Delivery confirmed.', 'success');
          await load();
          return;
        }
        openDealConversation(task);
      } catch (err) {
        onNotify?.(err instanceof Error ? err.message : 'Action failed', 'error');
      } finally {
        setActingId(null);
      }
    },
    [load, onNotify, openDealConversation],
  );

  const firstName = seller.name?.split(' ')[0] || 'there';
  const stats = data?.stats;
  const trustScore = stats?.trustScore ?? seller.trustScore ?? 50;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => void load()} className="text-sm font-semibold text-red-800 underline">
            Retry
          </button>
          {onSignInAgain && (
            <button type="button" onClick={onSignInAgain} className="text-sm font-semibold text-red-900 underline">
              Sign in again
            </button>
          )}
        </div>
      </div>
    );
  }

  const tasks = data?.tasks ?? [];
  const activeDeals = data?.activeDeals ?? [];

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {/* Header strip */}
      <div
        className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-reride-orange">Command Center</p>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              Good {new Date().getHours() < 12 ? 'morning' : 'day'}, {firstName}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {tasks.length > 0
                ? `${tasks.length} task${tasks.length === 1 ? '' : 's'} need your attention`
                : "You're all caught up — share listings to get more interest"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-4"
                style={{
                  borderColor: trustScore >= 70 ? '#10B981' : trustScore >= 50 ? '#F59E0B' : '#EF4444',
                  color: trustScore >= 70 ? '#059669' : trustScore >= 50 ? '#D97706' : '#DC2626',
                }}
                title="Trust score"
              >
                {trustScore}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">Trust</p>
            </div>
            {!compact && (
              <div className="text-right text-sm">
                <p className="font-bold text-slate-900 dark:text-white">{stats?.activeDealCount ?? 0} active deals</p>
                <p className="text-slate-500">
                  {(stats?.ratingAverage ?? 0).toFixed(1)} ★ ({stats?.ratingCount ?? 0})
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's tasks */}
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Today&apos;s Tasks</h3>
          {tasks.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {tasks.length}
            </span>
          )}
        </div>
        {tasks.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500">No pending tasks. Great work!</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.slice(0, compact ? 3 : 6).map((task) => (
              <li key={task.id} className="px-4 py-3 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${taskPriorityDot(task.priority)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{task.title}</p>
                  <p className="text-xs text-slate-500 truncate">{task.subtitle}</p>
                  <p className="text-[10px] font-mono text-reride-orange mt-0.5">{task.dealId}</p>
                </div>
                <button
                  type="button"
                  disabled={actingId === task.id}
                  onClick={() => void handleTaskAction(task)}
                  className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-reride-orange text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {actingId === task.id ? '…' : taskActionLabel(task.type)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active deals */}
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Deals</h3>
          <button
            type="button"
            onClick={onNavigateToMessages}
            className="text-xs font-semibold text-reride-orange hover:underline"
          >
            All messages →
          </button>
        </div>
        {activeDeals.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500 mb-3">When buyers tap &quot;I&apos;m Interested&quot;, deals appear here.</p>
            <button
              type="button"
              onClick={onNavigateToListings}
              className="text-sm font-bold text-reride-orange"
            >
              Manage listings
            </button>
          </div>
        ) : (
          <div className={`grid gap-2 p-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            {activeDeals.map((deal) => (
              <DealMiniCard
                key={deal.id}
                deal={deal}
                onOpen={() => {
                  if (onOpenDeal) {
                    onOpenDeal(deal.id);
                    return;
                  }
                  const task: SellerTask = {
                    id: deal.id,
                    dealId: deal.id,
                    type: 'respond_offer',
                    priority: 0,
                    title: '',
                    subtitle: '',
                    conversationId: deal.conversationId,
                  };
                  openDealConversation(task);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Calendar */}
      <SellerDealCalendar compact={compact} onOpenDeal={onOpenDeal} />

      {/* Quick actions */}
      {!compact && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNavigateToListings}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          >
            + List vehicle
          </button>
          <button
            type="button"
            onClick={onNavigateToMessages}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

const DealMiniCard: React.FC<{ deal: DealLead; onOpen: () => void }> = ({ deal, onOpen }) => {
  const buyer = deal.buyerDisplayName || deal.buyerName || 'Buyer';
  const vehicle = deal.metadata.vehicleName || 'Vehicle';
  const stage = dealStageLabel(deal.currentStage);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-reride-orange/50 transition-colors w-full"
    >
      <p className="text-[10px] font-mono font-bold text-reride-orange">{deal.id}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">{buyer}</p>
      <p className="text-xs text-slate-500 truncate">{vehicle}</p>
      <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {stage}
      </span>
      {deal.chatStatus === 'pending' && (
        <span className="ml-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
          Awaiting accept
        </span>
      )}
    </button>
  );
};

export default SellerCommandHome;
