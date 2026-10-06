import React, { useCallback, useEffect, useState } from 'react';
import type { Conversation, DealDetail, DealSellerNote, User } from '../../types.js';
import {
  DEAL_KANBAN_COLUMNS,
  dealKanbanLabel,
  dealStageLabel,
  deriveKanbanStatus,
} from '../../types.js';
import { parseSellerNotes } from '../../lib/dealSellerNotes.js';
import {
  acceptDealChat,
  fetchDealDetail,
  fetchInspectionBookings,
  updateDealNotes,
  updateAssistanceFulfillment,
  requestDealReturn,
  resolveDealReturn,
} from '../../services/dealService.js';
import {
  ASSISTANCE_FULFILLMENT_STATUSES,
  dealAssistancePackageLabel,
} from '../../types.js';
import MechanicBookingModal from './MechanicBookingModal.js';
import DealComplaintModal from './DealComplaintModal.js';
import DealSellerNotesList from './DealSellerNotesList.js';
import type { DealInspectionBooking, DealKanbanStatus } from '../../types.js';

const DEAL_PROGRESS_STEPS: { label: string; statuses: DealKanbanStatus[] }[] = [
  { label: 'Negotiation', statuses: ['lead_created', 'buyer_contacted', 'chat_started', 'offer_sent', 'negotiation'] },
  { label: 'Inspection', statuses: ['inspection'] },
  { label: 'Payment', statuses: ['payment_pending'] },
  { label: 'Delivery', statuses: ['vehicle_delivered'] },
  { label: 'RC transfer', statuses: ['rc_transfer'] },
  { label: 'Completed', statuses: ['completed'] },
];

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white dark:bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          {title}
          {count != null && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{count}</span>
          )}
        </h3>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export interface DealDetailPageProps {
  leadId: string;
  currentUser: User;
  role: 'seller' | 'customer' | 'admin';
  conversations?: Conversation[];
  onBack: () => void;
  onOpenConversation?: (conversation: Conversation) => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const DealDetailPage: React.FC<DealDetailPageProps> = ({
  leadId,
  currentUser,
  role,
  conversations = [],
  onBack,
  onOpenConversation,
  onNotify,
}) => {
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerNotesList, setSellerNotesList] = useState<DealSellerNote[]>([]);
  const [internalNotesDraft, setInternalNotesDraft] = useState('');
  const [savingSellerNotes, setSavingSellerNotes] = useState(false);
  const [sellerNotesError, setSellerNotesError] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [acceptingChat, setAcceptingChat] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [bookings, setBookings] = useState<DealInspectionBooking[]>([]);
  const [assistanceNotes, setAssistanceNotes] = useState('');
  const [savingAssistance, setSavingAssistance] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, inspectionBookings] = await Promise.all([
        fetchDealDetail(leadId),
        fetchInspectionBookings(leadId).catch(() => []),
      ]);
      setDeal(detail);
      setBookings(inspectionBookings);
      setSellerNotesList(detail.sellerNotesList ?? parseSellerNotes(detail.sellerNotes));
      setInternalNotesDraft(detail.internalNotes || '');
      setAssistanceNotes(detail.metadata.assistanceFulfillment?.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deal');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenChat = useCallback(() => {
    if (!deal?.conversationId) {
      onNotify?.('No conversation linked yet.', 'info');
      return;
    }
    const conv = conversations.find((c) => String(c.id) === String(deal.conversationId));
    if (conv && onOpenConversation) {
      onOpenConversation(conv);
    } else {
      onNotify?.('Open Messages to continue the chat.', 'info');
    }
  }, [conversations, deal, onNotify, onOpenConversation]);

  const handleAcceptChat = useCallback(async () => {
    if (!deal) return;
    setAcceptingChat(true);
    try {
      const updated = await acceptDealChat(deal.id, deal.conversationId);
      setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
      onNotify?.('Chat accepted.', 'success');
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Failed to accept chat', 'error');
    } finally {
      setAcceptingChat(false);
    }
  }, [deal, onNotify]);

  const persistSellerNotes = useCallback(
    async (nextNotes: DealSellerNote[]) => {
      if (!deal) return;
      const previous = sellerNotesList;
      setSellerNotesList(nextNotes);
      setSavingSellerNotes(true);
      setSellerNotesError(null);
      try {
        const updated = await updateDealNotes({
          leadId: deal.id,
          sellerNotesList: nextNotes,
        });
        const saved = updated.sellerNotesList ?? parseSellerNotes(updated.sellerNotes);
        setSellerNotesList(saved);
        setDeal((prev) => (prev ? { ...prev, ...updated, sellerNotesList: saved } : prev));
      } catch (err) {
        setSellerNotesList(previous);
        const message = err instanceof Error ? err.message : 'Could not save note';
        setSellerNotesError(message);
        onNotify?.(message, 'error');
      } finally {
        setSavingSellerNotes(false);
      }
    },
    [deal, onNotify, sellerNotesList],
  );

  const handleSaveInternalNotes = useCallback(async () => {
    if (!deal || role !== 'admin') return;
    setSavingNotes(true);
    try {
      const updated = await updateDealNotes({
        leadId: deal.id,
        internalNotes: internalNotesDraft,
      });
      setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
      setInternalNotesDraft(updated.internalNotes ?? internalNotesDraft);
      onNotify?.('Internal notes saved.', 'success');
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Could not save notes', 'error');
    } finally {
      setSavingNotes(false);
    }
  }, [deal, internalNotesDraft, onNotify, role]);

  const handleRequestReturn = useCallback(async () => {
    if (!deal) return;
    setReturnLoading(true);
    try {
      const updated = await requestDealReturn(deal.id, returnReason.trim() || undefined);
      setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
      setReturnReason('');
      onNotify?.('Return recorded. Seller will review next steps.', 'success');
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Could not record return', 'error');
    } finally {
      setReturnLoading(false);
    }
  }, [deal, onNotify, returnReason]);

  const handleResolveReturn = useCallback(
    async (action: 'relist' | 'archive') => {
      if (!deal) return;
      const label = action === 'relist' ? 'relist this vehicle' : 'archive this vehicle';
      if (!window.confirm(`Are you sure you want to ${label}?`)) return;
      setReturnLoading(true);
      try {
        const updated = await resolveDealReturn(deal.id, action);
        setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
        onNotify?.(
          action === 'relist' ? 'Vehicle relisted and available for new buyers.' : 'Vehicle archived.',
          'success',
        );
      } catch (err) {
        onNotify?.(err instanceof Error ? err.message : 'Could not resolve return', 'error');
      } finally {
        setReturnLoading(false);
      }
    },
    [deal, onNotify],
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-5 w-16 bg-slate-100 rounded" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="h-44 bg-slate-100 rounded-2xl" />
            <div className="h-56 bg-slate-100 rounded-2xl" />
          </div>
          <div className="h-40 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error || 'Deal not found'}</p>
        <button type="button" onClick={onBack} className="mt-3 text-sm font-semibold text-red-800 underline">
          ← Back
        </button>
      </div>
    );
  }

  const buyer = deal.buyerDisplayName || deal.buyerName || deal.buyerEmail;
  const seller = deal.sellerDisplayName || deal.sellerEmail;
  const vehicle = deal.vehicleName || deal.metadata.vehicleName || 'Vehicle';
  const derivedKanbanStatus = deriveKanbanStatus(deal);
  const currentStep = DEAL_PROGRESS_STEPS.findIndex((s) => s.statuses.includes(derivedKanbanStatus));
  const kanbanColor = DEAL_KANBAN_COLUMNS.find((c) => c.status === derivedKanbanStatus)?.color
    || 'bg-slate-100 text-slate-700';
  const showSellerNotes = role === 'seller' || role === 'admin';
  const showInternalNotes = role === 'admin';
  const canBookInspection =
    deal.status === 'active' &&
    (
      (['offer_accepted', 'inspection_requested', 'inspection_completed'].includes(deal.currentStage)
        && !deal.metadata.inspection?.completedAt)
      || (role === 'admin'
        && deal.metadata.assistanceFulfillment?.needsInspectionBooking
        && !deal.metadata.inspection?.bookingId)
    );
  const hasAssistance = Boolean(deal.metadata.assistancePackage || deal.metadata.assistanceFulfillment);
  const assistanceStatus = deal.metadata.assistanceFulfillment?.status || 'requested';
  const timelineForDisplay = (deal.timeline || []).filter((evt) => evt.eventType !== 'kanban_moved');
  const isDealCompleted = deal.status === 'completed' && deal.currentStage === 'deal_completed';
  const canRequestReturn = isDealCompleted && !deal.returnStatus && (role === 'customer' || role === 'seller' || role === 'admin');
  const canReviewReturn = isDealCompleted && deal.returnStatus === 'returned' && (role === 'seller' || role === 'admin');

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-semibold text-slate-600 hover:text-reride-orange"
      >
        ← Back
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-mono font-bold text-reride-orange">{deal.id}</p>
                <h2 className="text-lg font-bold text-slate-900">{vehicle}</h2>
              </div>
              <span
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${kanbanColor}`}
                title={dealKanbanLabel(derivedKanbanStatus)}
              >
                {dealStageLabel(deal.currentStage)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {deal.vehiclePrice != null && (
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium text-slate-500">Listed price</p>
                  <p className="text-sm font-bold text-slate-900">₹{deal.vehiclePrice.toLocaleString('en-IN')}</p>
                </div>
              )}
              {deal.metadata.acceptedOfferAmount && (
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] font-medium text-emerald-700">Agreed price</p>
                  <p className="text-sm font-bold text-emerald-800">₹{deal.metadata.acceptedOfferAmount.toLocaleString('en-IN')}</p>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 px-3 py-2 min-w-0">
                <p className="text-[10px] font-medium text-slate-500">{role === 'customer' ? 'Seller' : 'Buyer'}</p>
                <p className="text-sm font-bold text-slate-900 truncate">{role === 'customer' ? seller : buyer}</p>
              </div>
            </div>

            {currentStep >= 0 && (
              <ol className="mt-4 grid grid-cols-6 gap-1" aria-label="Deal progress">
                {DEAL_PROGRESS_STEPS.map((step, i) => (
                  <li key={step.label} aria-current={i === currentStep ? 'step' : undefined}>
                    <div className={`h-1.5 rounded-full ${i <= currentStep ? 'bg-reride-orange' : 'bg-slate-200'}`} />
                    <p className={`mt-1 text-[10px] leading-tight ${i === currentStep ? 'font-semibold text-slate-900' : i < currentStep ? 'text-slate-600' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
              {role === 'seller' && deal.chatStatus === 'pending' && (
                <button
                  type="button"
                  disabled={acceptingChat}
                  onClick={() => void handleAcceptChat()}
                  className="px-4 py-2 text-sm font-bold rounded-xl bg-reride-orange text-white disabled:opacity-50"
                >
                  {acceptingChat ? 'Accepting…' : 'Accept Chat'}
                </button>
              )}
              {deal.conversationId && (
                <button
                  type="button"
                  onClick={handleOpenChat}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700"
                >
                  Open chat
                </button>
              )}
              {canBookInspection && (
                <button
                  type="button"
                  onClick={() => setShowBookingModal(true)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 text-white"
                >
                  Book mechanic
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowComplaintModal(true)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-red-200 text-red-700"
              >
                Report issue
              </button>
            </div>
          </div>

          {(canRequestReturn || canReviewReturn || deal.returnStatus) && (
            <div
              data-testid="deal-return-panel"
              className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900">Return lifecycle</h3>
              {deal.returnStatus === 'relisted' && (
                <p className="text-sm text-emerald-800">Vehicle was relisted after this return. Deal history is preserved.</p>
              )}
              {deal.returnStatus === 'archived' && (
                <p className="text-sm text-slate-700">Vehicle was archived after this return.</p>
              )}
              {canRequestReturn && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    Report that the vehicle was returned. The seller will choose to relist or archive.
                  </p>
                  <textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Reason for return (optional)"
                    rows={2}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2"
                  />
                  <button
                    type="button"
                    data-testid="deal-return-request"
                    disabled={returnLoading}
                    onClick={() => void handleRequestReturn()}
                    className="px-4 py-2 text-sm font-bold rounded-xl bg-amber-600 text-white disabled:opacity-50"
                  >
                    {returnLoading ? 'Submitting…' : 'Report return'}
                  </button>
                </div>
              )}
              {canReviewReturn && (
                <div className="space-y-2">
                  {deal.returnReason && (
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold">Reason:</span> {deal.returnReason}
                    </p>
                  )}
                  <p className="text-xs text-slate-600">
                    Choose whether to put this vehicle back on the market or archive it. Deal and message history stay intact.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="deal-return-relist"
                      disabled={returnLoading}
                      onClick={() => void handleResolveReturn('relist')}
                      className="px-4 py-2 text-sm font-bold rounded-xl bg-emerald-600 text-white disabled:opacity-50"
                    >
                      Relist vehicle
                    </button>
                    <button
                      type="button"
                      data-testid="deal-return-archive"
                      disabled={returnLoading}
                      onClick={() => void handleResolveReturn('archive')}
                      className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-300 text-slate-700 disabled:opacity-50"
                    >
                      Archive vehicle
                    </button>
                  </div>
                </div>
              )}
              {deal.returnStatus === 'returned' && role === 'customer' && (
                <p className="text-sm text-amber-800">Return submitted — waiting for seller review.</p>
              )}
            </div>
          )}

          {deal.offers && deal.offers.length > 0 && (
            <Section title="Negotiation" count={deal.offers.length} hint="Offers in the order they were made">
              <ul className="divide-y divide-slate-100">
                {deal.offers.map((o) => (
                  <li key={o.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-900">₹{o.amount.toLocaleString('en-IN')}</span>
                    <span className="flex-1 text-xs text-slate-500 capitalize">by {o.offeredBy}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        o.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : o.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : o.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {o.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(deal.documents?.length || bookings.length > 0) ? (
            <Section title="Inspection & documents">
              <div className="grid gap-4 sm:grid-cols-2">
                {bookings.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">Inspection</p>
                    <ul className="space-y-2">
                      {bookings.map((b) => (
                        <li key={b.id} className="text-xs border border-slate-100 rounded-lg p-2">
                          <p className="font-semibold text-slate-800">
                            {b.scheduledDate} · {b.scheduledTime}
                          </p>
                          <p className="text-slate-500 truncate">{b.address}</p>
                          <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                            {b.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {deal.documents && deal.documents.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">Documents</p>
                    <ul className="space-y-1.5">
                      {deal.documents.map((d) => (
                        <li key={d.id}>
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 capitalize hover:border-reride-orange/40 hover:text-reride-orange"
                          >
                            <span aria-hidden>📄</span>
                            <span className="flex-1">{d.docType.replace(/_/g, ' ')}</span>
                            <span aria-hidden>↗</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          ) : null}

          <Section title="People">
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { role: 'Buyer', name: buyer, email: deal.buyerEmail },
                { role: 'Seller', name: seller, email: deal.sellerEmail },
                ...(deal.assignedAdminEmail
                  ? [{ role: 'Assigned admin', name: deal.assignedAdminEmail, email: '' }]
                  : []),
              ].map((p) => (
                <li key={p.role} className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center uppercase"
                    aria-hidden
                  >
                    {p.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{p.role}</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                    {p.email && <p className="text-xs text-slate-500 truncate">{p.email}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <aside className="space-y-4">
          {timelineForDisplay.length > 0 && (
            <Section title="Activity" count={timelineForDisplay.length} hint="Newest first">
              <ul className="max-h-96 overflow-y-auto pl-1.5 pr-1">
                {[...timelineForDisplay].reverse().map((evt, i, all) => (
                  <li
                    key={evt.id}
                    className={`relative pl-4 text-xs border-l-2 border-slate-100 ${i === all.length - 1 ? '' : 'pb-3'}`}
                  >
                    <span
                      className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ring-2 ring-white ${i === 0 ? 'bg-reride-orange' : 'bg-slate-300'}`}
                      aria-hidden
                    />
                    <p className={i === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                      {evt.label || evt.stage}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(evt.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {showSellerNotes && (
            <Section title="Seller notes" count={sellerNotesList.length} hint="Add notes one at a time. Each saves automatically.">
              {sellerNotesError && (
                <p className="mb-2 text-xs font-medium text-red-600">{sellerNotesError}</p>
              )}
              <DealSellerNotesList
                notes={sellerNotesList}
                saving={savingSellerNotes}
                onChange={(next) => void persistSellerNotes(next)}
              />
            </Section>
          )}

          {showInternalNotes && hasAssistance && (
            <div className="rounded-2xl border border-reride-orange/30 bg-orange-50/40 p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-reride-orange">Deal assistance</h3>
              <div className="text-xs space-y-1">
                <p>
                  <span className="text-slate-500">Package:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    {dealAssistancePackageLabel(deal.metadata.assistancePackage || '')}
                  </span>
                </p>
                {deal.metadata.assistancePayment?.amount && (
                  <p>
                    <span className="text-slate-500">Paid:</span>{' '}
                    <span className="font-semibold">
                      ₹{deal.metadata.assistancePayment.amount.toLocaleString('en-IN')}
                    </span>
                    {deal.metadata.assistancePayment.paidAt && (
                      <span className="text-slate-400 ml-1">
                        · {new Date(deal.metadata.assistancePayment.paidAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </p>
                )}
                <p>
                  <span className="text-slate-500">Source:</span>{' '}
                  <span className="capitalize">{deal.metadata.assistanceFulfillment?.source || 'purchase'}</span>
                </p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-slate-400">Status</label>
                <select
                  value={assistanceStatus}
                  disabled={savingAssistance}
                  onChange={async (e) => {
                    setSavingAssistance(true);
                    try {
                      const updated = await updateAssistanceFulfillment({
                        leadId: deal.id,
                        status: e.target.value as typeof assistanceStatus,
                      });
                      setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
                      onNotify?.('Assistance status updated.', 'success');
                    } catch (err) {
                      onNotify?.(err instanceof Error ? err.message : 'Update failed', 'error');
                    } finally {
                      setSavingAssistance(false);
                    }
                  }}
                  className="mt-1 w-full text-sm border border-orange-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  {ASSISTANCE_FULFILLMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={assistanceNotes}
                onChange={(e) => setAssistanceNotes(e.target.value)}
                rows={3}
                placeholder="Ops notes for this assistance request…"
                className="w-full text-sm border border-orange-200 rounded-lg p-2 resize-none bg-white"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingAssistance}
                  onClick={async () => {
                    setSavingAssistance(true);
                    try {
                      const updated = await updateAssistanceFulfillment({
                        leadId: deal.id,
                        notes: assistanceNotes,
                        assignToMe: true,
                      });
                      setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
                      onNotify?.('Assigned to you.', 'success');
                    } catch (err) {
                      onNotify?.(err instanceof Error ? err.message : 'Assign failed', 'error');
                    } finally {
                      setSavingAssistance(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                  Assign to me
                </button>
                <button
                  type="button"
                  disabled={savingAssistance}
                  onClick={async () => {
                    setSavingAssistance(true);
                    try {
                      const updated = await updateAssistanceFulfillment({
                        leadId: deal.id,
                        notes: assistanceNotes,
                      });
                      setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
                      onNotify?.('Notes saved.', 'success');
                    } catch (err) {
                      onNotify?.(err instanceof Error ? err.message : 'Save failed', 'error');
                    } finally {
                      setSavingAssistance(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-orange-300 text-orange-800 disabled:opacity-50"
                >
                  Save fulfillment notes
                </button>
                {deal.metadata.assistanceFulfillment?.needsInspectionBooking && !deal.metadata.inspection?.bookingId && (
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(true)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 text-white"
                  >
                    Book mechanic
                  </button>
                )}
              </div>
            </div>
          )}

          {showInternalNotes && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-2">Internal notes (admin only)</h3>
              <textarea
                value={internalNotesDraft}
                onChange={(e) => setInternalNotesDraft(e.target.value)}
                rows={4}
                placeholder="Ops notes — not visible to seller/buyer…"
                className="w-full text-sm border border-amber-200 rounded-lg p-2 resize-none bg-white"
              />
              <button
                type="button"
                disabled={savingNotes}
                onClick={() => void handleSaveInternalNotes()}
                className="mt-3 w-full py-2 text-sm font-bold rounded-xl bg-amber-900 text-white disabled:opacity-50"
              >
                {savingNotes ? 'Saving…' : 'Save internal notes'}
              </button>
            </div>
          )}
        </aside>
      </div>

      {showBookingModal && deal && (
        <MechanicBookingModal
          lead={deal}
          onClose={() => setShowBookingModal(false)}
          onBooked={(updated) => {
            setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
            void load();
          }}
          onNotify={(msg, type) => onNotify?.(msg, type ?? 'info')}
        />
      )}
      {showComplaintModal && (
        <DealComplaintModal
          leadId={leadId}
          onClose={() => setShowComplaintModal(false)}
          onNotify={(msg, type) => onNotify?.(msg, type ?? 'info')}
        />
      )}
    </div>
  );
};

export default DealDetailPage;
