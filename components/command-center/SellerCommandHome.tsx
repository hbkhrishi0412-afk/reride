import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation, User } from '../../types.js';
import { dealStageLabel, type DealLead, type SellerCommandCenter, type SellerTask } from '../../types.js';
import {
  acceptDealChat,
  advanceDealStage,
  fetchSellerCommandCenter,
  invalidateSellerCommandCenterCache,
} from '../../services/dealService.js';
import {
  VIEW_DISMISSIBLE_TASK_TYPES,
  getViewedSellerTaskIds,
  markSellerTaskViewed,
} from '../../utils/sellerViewedTasks.js';
import SellerDealCalendar from './SellerDealCalendar.js';

export interface SellerCommandHomeProps {
  seller: User;
  conversations: Conversation[];
  compact?: boolean;
  commandCenter?: SellerCommandCenter | null;
  commandCenterLoading?: boolean;
  commandCenterError?: string | null;
  onRefreshCommandCenter?: (force?: boolean) => void | Promise<void>;
  onOpenConversation?: (conversation: Conversation) => void;
  onOpenDeal?: (leadId: string) => void;
  onNavigateToMessages?: () => void;
  onNavigateToListings?: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onSignInAgain?: () => void;
  /** Fires when an informational task is viewed so parent badges can update. */
  onTaskViewed?: (taskId: string) => void;
}

const TASKS_PAGE = 5;
const DEALS_PAGE = 8;

type DealFilter = 'all' | 'awaiting' | 'closing';

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
    case 'review_return':
      return 'Review';
    default:
      return 'Open';
  }
}

function taskPriorityDot(priority: number): string {
  if (priority >= 90) return 'bg-red-500';
  if (priority >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

function taskMatchesQuery(task: SellerTask, query: string): boolean {
  if (!query.trim()) return true;
  return (
    matchesQuery(task.title, query)
    || matchesQuery(task.subtitle, query)
    || matchesQuery(task.dealId, query)
  );
}

function dealMatchesQuery(deal: DealLead, query: string): boolean {
  if (!query.trim()) return true;
  const buyer = deal.buyerDisplayName || deal.buyerName || '';
  const vehicle = deal.metadata.vehicleName || '';
  return (
    matchesQuery(buyer, query)
    || matchesQuery(vehicle, query)
    || matchesQuery(deal.id, query)
  );
}

function dealMatchesFilter(deal: DealLead, filter: DealFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'awaiting') return deal.chatStatus === 'pending';
  const closingStages = [
    'token_confirmed',
    'delivery_pending',
    'delivery_completed',
    'documents_pending',
    'documents_completed',
    'rc_pending',
    'rc_completed',
  ];
  if (filter === 'closing') return closingStages.includes(deal.currentStage);
  return true;
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/40">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-reride-orange/25 focus:border-reride-orange/40"
      />
    </div>
  );
}

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: { id: DealFilter; label: string }[];
  value: DealFilter;
  onChange: (id: DealFilter) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            value === opt.id
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  badge,
  headerAction,
  defaultOpen,
  collapsedSummary,
  compact,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  defaultOpen: boolean;
  collapsedSummary?: string;
  compact: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [userToggled, setUserToggled] = useState(false);

  useEffect(() => {
    if (!userToggled) setOpen(defaultOpen);
  }, [defaultOpen, userToggled]);

  if (!compact) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 gap-2">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {badge}
            {headerAction}
          </div>
        </div>
        {children}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center border-b border-slate-100">
        <button
          type="button"
          onClick={() => {
            setUserToggled(true);
            setOpen((v) => !v);
          }}
          className="flex-1 min-w-0 text-left px-3 py-2 flex items-center gap-2 active:bg-slate-50"
          aria-expanded={open}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              {badge}
            </div>
            {!open && collapsedSummary && (
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{collapsedSummary}</p>
            )}
          </div>
          <span
            className={`shrink-0 text-[10px] text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        {headerAction && (
          <div className="shrink-0 pr-3" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>
      {open && children}
    </section>
  );
}

export const SellerCommandHome: React.FC<SellerCommandHomeProps> = ({
  seller,
  conversations,
  compact = false,
  commandCenter: externalCommandCenter,
  commandCenterLoading,
  commandCenterError,
  onRefreshCommandCenter,
  onOpenConversation,
  onOpenDeal,
  onNavigateToMessages,
  onNavigateToListings,
  onNotify,
  onSignInAgain,
  onTaskViewed,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<SellerCommandCenter | null>(externalCommandCenter ?? null);
  const [loading, setLoading] = useState(
    externalCommandCenter === undefined && commandCenterLoading !== false,
  );
  const [error, setError] = useState<string | null>(commandCenterError ?? null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [taskQuery, setTaskQuery] = useState('');
  const [dealQuery, setDealQuery] = useState('');
  const [dealFilter, setDealFilter] = useState<DealFilter>('all');
  const [tasksVisible, setTasksVisible] = useState(TASKS_PAGE);
  const [dealsVisible, setDealsVisible] = useState(DEALS_PAGE);
  const [viewedTaskIds, setViewedTaskIds] = useState<Set<string>>(() => getViewedSellerTaskIds());
  const retryAvailableAtRef = useRef(0);

  const usesExternalData = externalCommandCenter !== undefined || onRefreshCommandCenter !== undefined;

  useEffect(() => {
    if (!usesExternalData) return;
    setData(externalCommandCenter ?? null);
    if (commandCenterLoading !== undefined) setLoading(commandCenterLoading);
    if (commandCenterError !== undefined) setError(commandCenterError);
  }, [usesExternalData, externalCommandCenter, commandCenterLoading, commandCenterError]);

  const load = useCallback(async (force = false) => {
    if (onRefreshCommandCenter) {
      await onRefreshCommandCenter(force);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { rehydrateApiCredentials } = await import('../../utils/validatePersistedSession.js');
      await rehydrateApiCredentials();
      if (force) invalidateSellerCommandCenterCache();
      const center = await fetchSellerCommandCenter(force);
      setData(center);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Could not load command center';
      const message = /authentication required/i.test(raw)
        ? 'Your session is missing API credentials. Please log out and sign in again.'
        : raw;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onRefreshCommandCenter]);

  const handleRetry = useCallback(() => {
    const now = Date.now();
    if (now < retryAvailableAtRef.current) return;
    retryAvailableAtRef.current = now + 8000;
    void load(true);
  }, [load]);

  useEffect(() => {
    if (usesExternalData) return;
    void load(false);
  }, [usesExternalData, load]);

  useEffect(() => {
    setTasksVisible(TASKS_PAGE);
  }, [taskQuery]);

  useEffect(() => {
    setDealsVisible(DEALS_PAGE);
  }, [dealQuery, dealFilter]);

  const dismissViewableTask = useCallback(
    (task: SellerTask) => {
      if (!VIEW_DISMISSIBLE_TASK_TYPES.has(task.type)) return;
      markSellerTaskViewed(task.id);
      setViewedTaskIds(getViewedSellerTaskIds());
      onTaskViewed?.(task.id);
    },
    [onTaskViewed],
  );

  const openDealConversation = useCallback(
    (task: SellerTask) => {
      if (!task.conversationId) {
        onNavigateToMessages?.();
        return;
      }
      const conv = conversations.find((c) => String(c.id) === String(task.conversationId));
      if (conv && onOpenConversation) onOpenConversation(conv);
      else onNavigateToMessages?.();
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
          await load(true);
          openDealConversation(task);
          return;
        }
        if (task.type === 'confirm_token') {
          await advanceDealStage(task.dealId, 'token_confirmed');
          onNotify?.('Token confirmed.', 'success');
          await load(true);
          return;
        }
        if (task.type === 'confirm_delivery') {
          await advanceDealStage(task.dealId, 'delivery_pending');
          onNotify?.('Delivery confirmed.', 'success');
          await load(true);
          return;
        }
        if (task.type === 'review_return') {
          onOpenDeal?.(task.dealId);
          return;
        }
        if (VIEW_DISMISSIBLE_TASK_TYPES.has(task.type)) {
          dismissViewableTask(task);
        }
        openDealConversation(task);
      } catch (err) {
        onNotify?.(err instanceof Error ? err.message : 'Action failed', 'error');
      } finally {
        setActingId(null);
      }
    },
    [dismissViewableTask, load, onNotify, onOpenDeal, openDealConversation],
  );

  const openDeal = useCallback(
    (deal: DealLead) => {
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
    },
    [onOpenDeal, openDealConversation],
  );

  const firstName = seller.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const stats = data?.stats;
  const trustScore = stats?.trustScore ?? seller.trustScore ?? 50;
  const tasks = useMemo(() => {
    const all = data?.tasks ?? [];
    return all.filter(
      (task) =>
        !(VIEW_DISMISSIBLE_TASK_TYPES.has(task.type) && viewedTaskIds.has(String(task.id))),
    );
  }, [data?.tasks, viewedTaskIds]);
  const activeDeals = data?.activeDeals ?? [];

  const filteredTasks = useMemo(
    () => tasks.filter((task) => taskMatchesQuery(task, taskQuery)),
    [tasks, taskQuery],
  );

  const filteredDeals = useMemo(
    () =>
      activeDeals
        .filter((deal) => dealMatchesFilter(deal, dealFilter))
        .filter((deal) => dealMatchesQuery(deal, dealQuery))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [activeDeals, dealFilter, dealQuery],
  );

  const visibleTasks = filteredTasks.slice(0, tasksVisible);
  const visibleDeals = filteredDeals.slice(0, dealsVisible);

  const dealFilterOptions = useMemo(
    (): { id: DealFilter; label: string }[] => [
      { id: 'all', label: t('sellerDashboard.hotLeads.filterAll') },
      { id: 'awaiting', label: t('sellerDashboard.hotLeads.filterAwaiting') },
      { id: 'closing', label: t('sellerDashboard.hotLeads.filterClosing') },
    ],
    [t],
  );

  const tasksCollapsedSummary =
    tasks.length === 0
      ? t('sellerDashboard.hotLeads.tasksEmpty')
      : t('sellerDashboard.hotLeads.tasksNeedAttention', { count: tasks.length });

  const dealsCollapsedSummary =
    activeDeals.length === 0
      ? t('sellerDashboard.hotLeads.dealsEmpty')
      : t('sellerDashboard.hotLeads.dealsCollapsedSummary', {
          count: activeDeals.length,
          defaultValue: '{{count}} active deals',
        });

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-40 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={handleRetry} className="text-sm font-semibold text-red-800 underline">
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

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {error && data && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          {error} Showing your last loaded data.
        </div>
      )}
      <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={`font-bold text-slate-900 tracking-tight leading-tight ${compact ? 'text-[16px]' : 'text-lg'}`}>
              Good {greeting}, {firstName}
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {tasks.length > 0
                ? t('sellerDashboard.hotLeads.tasksNeedAttention', { count: tasks.length })
                : t('sellerDashboard.hotLeads.caughtUp')}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onNavigateToListings}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-95"
            >
              + List vehicle
            </button>
            <button
              type="button"
              onClick={onNavigateToMessages}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95"
            >
              Messages
            </button>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 active:scale-95"
            >
              <span className={loading ? 'inline-block animate-spin' : 'inline-block'} aria-hidden>↻</span>
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Tasks', value: tasks.length },
            { label: 'Deals', value: stats?.activeDealCount ?? activeDeals.length },
            { label: `Rating (${stats?.ratingCount ?? 0})`, value: `${(stats?.ratingAverage ?? 0).toFixed(1)}★` },
            { label: 'Trust', value: trustScore, className: trustScore >= 70 ? 'text-emerald-600' : trustScore >= 50 ? 'text-amber-600' : 'text-red-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 py-2">
              <p className={`text-base font-bold ${s.className ?? 'text-slate-900'}`}>{s.value}</p>
              <p className="text-[10px] font-medium text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={compact ? 'space-y-2' : 'grid gap-3 items-start xl:grid-cols-[minmax(0,1fr)_300px]'}>
      <div className={compact ? 'space-y-2' : 'space-y-3 min-w-0'}>
      {/* Today's tasks */}
      {tasks.length > 0 && (
      <CollapsibleSection
        title={t('sellerDashboard.hotLeads.tasksTitle')}
        compact={compact}
        defaultOpen
        collapsedSummary={tasksCollapsedSummary}
        badge={
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {tasks.length}
          </span>
        }
      >
        {tasks.length > 3 && (
          <SearchInput
            value={taskQuery}
            onChange={setTaskQuery}
            placeholder={t('sellerDashboard.hotLeads.searchTasks')}
          />
        )}

        {filteredTasks.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-[13px] text-slate-500">{t('sellerDashboard.hotLeads.noSearchResults')}</p>
          </div>
        ) : (
          <>
            <ul className={`divide-y divide-slate-100 ${filteredTasks.length > TASKS_PAGE ? 'max-h-64 overflow-y-auto' : ''}`}>
              {visibleTasks.map((task) => (
                <li key={task.id} className="px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-50/80">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${taskPriorityDot(task.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
                    <p className="text-xs text-slate-500 truncate">{task.subtitle}</p>
                    <p className="text-[10px] font-mono text-reride-orange mt-0.5">{task.dealId}</p>
                  </div>
                  <button
                    type="button"
                    disabled={actingId === task.id}
                    onClick={() => void handleTaskAction(task)}
                    className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-reride-orange text-white hover:bg-orange-600 disabled:opacity-50 active:scale-95"
                  >
                    {actingId === task.id ? '…' : taskActionLabel(task.type)}
                  </button>
                </li>
              ))}
            </ul>
            <ListFooter
              shown={visibleTasks.length}
              total={filteredTasks.length}
              pageSize={TASKS_PAGE}
              onShowMore={() => setTasksVisible((n) => n + TASKS_PAGE)}
              onShowLess={() => setTasksVisible(TASKS_PAGE)}
              t={t}
            />
          </>
        )}
      </CollapsibleSection>
      )}

      {/* Active deals */}
      <CollapsibleSection
        title={t('sellerDashboard.hotLeads.dealsTitle')}
        compact={compact}
        defaultOpen
        collapsedSummary={dealsCollapsedSummary}
        headerAction={
          <button
            type="button"
            onClick={onNavigateToMessages}
            className="text-xs font-semibold text-reride-orange hover:underline shrink-0"
          >
            {t('sellerDashboard.hotLeads.allMessages')}
          </button>
        }
      >
        {activeDeals.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-center gap-2">
            <FilterPills
              options={dealFilterOptions.map((opt) => ({
                ...opt,
                label: `${opt.label} · ${activeDeals.filter((d) => dealMatchesFilter(d, opt.id)).length}`,
              }))}
              value={dealFilter}
              onChange={setDealFilter}
            />
            {activeDeals.length > 3 && (
              <input
                type="search"
                value={dealQuery}
                onChange={(e) => setDealQuery(e.target.value)}
                placeholder={t('sellerDashboard.hotLeads.searchDeals')}
                className="flex-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-reride-orange/25 focus:border-reride-orange/40"
              />
            )}
          </div>
        )}

        {activeDeals.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <p className="text-[13px] text-slate-500 mb-2">{t('sellerDashboard.hotLeads.dealsEmpty')}</p>
            <button
              type="button"
              onClick={onNavigateToListings}
              className="text-sm font-bold text-reride-orange"
            >
              {t('sellerDashboard.hotLeads.dealsEmptyCta')}
            </button>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-[13px] text-slate-500">{t('sellerDashboard.hotLeads.noSearchResults')}</p>
          </div>
        ) : (
          <>
            <ul className={`divide-y divide-slate-100 ${filteredDeals.length > DEALS_PAGE ? 'max-h-72 overflow-y-auto' : ''}`}>
              {visibleDeals.map((deal) => (
                <DealListRow key={deal.id} deal={deal} onOpen={() => openDeal(deal)} />
              ))}
            </ul>
            <ListFooter
              shown={visibleDeals.length}
              total={filteredDeals.length}
              pageSize={DEALS_PAGE}
              onShowMore={() => setDealsVisible((n) => n + DEALS_PAGE)}
              onShowLess={() => setDealsVisible(DEALS_PAGE)}
              t={t}
            />
          </>
        )}
      </CollapsibleSection>
      </div>

      <SellerDealCalendar compact={compact} onOpenDeal={onOpenDeal} reloadToken={data} />
      </div>
    </div>
  );
};

function ListFooter({
  shown,
  total,
  pageSize,
  onShowMore,
  onShowLess,
  t,
}: {
  shown: number;
  total: number;
  pageSize: number;
  onShowMore: () => void;
  onShowLess: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (total <= pageSize) return null;

  return (
    <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-2">
      <p className="text-[11px] text-slate-500 font-medium">
        {t('sellerDashboard.hotLeads.showingCount', { shown, total })}
      </p>
      {shown < total ? (
        <button
          type="button"
          onClick={onShowMore}
          className="text-xs font-semibold text-reride-orange hover:underline shrink-0"
        >
          {t('sellerDashboard.hotLeads.showMore', { count: Math.min(total - shown, pageSize) })}
        </button>
      ) : (
        <button
          type="button"
          onClick={onShowLess}
          className="text-xs font-semibold text-slate-500 hover:underline shrink-0"
        >
          {t('sellerDashboard.hotLeads.showLess')}
        </button>
      )}
    </div>
  );
}

const DealListRow: React.FC<{
  deal: DealLead;
  onOpen: () => void;
}> = ({ deal, onOpen }) => {
  const buyer = deal.buyerDisplayName || deal.buyerName || 'Buyer';
  const vehicle = deal.metadata.vehicleName || 'Vehicle';
  const stage = dealStageLabel(deal.currentStage);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 active:bg-orange-50/40 transition-colors"
      >
        <span
          className="shrink-0 w-9 h-9 rounded-full bg-orange-50 text-reride-orange text-sm font-bold flex items-center justify-center uppercase"
          aria-hidden
        >
          {buyer.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{buyer}</p>
          <p className="text-xs text-slate-500 truncate">
            {vehicle} · <span className="font-mono text-reride-orange">{deal.id}</span>
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            {deal.chatStatus === 'pending' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Awaiting
              </span>
            )}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {stage}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-reride-orange group-hover:underline">View →</span>
        </div>
      </button>
    </li>
  );
};

export default SellerCommandHome;
