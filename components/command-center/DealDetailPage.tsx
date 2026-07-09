import React, { useCallback, useEffect, useState } from 'react';
import type { Conversation, DealDetail, User } from '../../types.js';
import {
  DEAL_KANBAN_COLUMNS,
  dealKanbanLabel,
  dealStageLabel,
  deriveKanbanStatus,
} from '../../types.js';
import { DealTimelinePanel } from '../DealTimelinePanel.js';
import {
  acceptDealChat,
  fetchDealDetail,
  fetchInspectionBookings,
  updateDealNotes,
  updateAssistanceFulfillment,
} from '../../services/dealService.js';
import {
  ASSISTANCE_FULFILLMENT_STATUSES,
  dealAssistancePackageLabel,
} from '../../types.js';
import MechanicBookingModal from './MechanicBookingModal.js';
import DealComplaintModal from './DealComplaintModal.js';
import type { DealInspectionBooking } from '../../types.js';

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
  const [notesDraft, setNotesDraft] = useState('');
  const [internalNotesDraft, setInternalNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [acceptingChat, setAcceptingChat] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [bookings, setBookings] = useState<DealInspectionBooking[]>([]);
  const [assistanceNotes, setAssistanceNotes] = useState('');
  const [savingAssistance, setSavingAssistance] = useState(false);

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
      setNotesDraft(detail.sellerNotes || '');
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

  const handleSaveNotes = useCallback(async () => {
    if (!deal) return;
    setSavingNotes(true);
    try {
      const updated = await updateDealNotes({
        leadId: deal.id,
        sellerNotes: role === 'seller' || role === 'admin' ? notesDraft : undefined,
        internalNotes: role === 'admin' ? internalNotesDraft : undefined,
      });
      setDeal((prev) => (prev ? { ...prev, ...updated } : prev));
      onNotify?.('Notes saved.', 'success');
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Could not save notes', 'error');
    } finally {
      setSavingNotes(false);
    }
  }, [deal, internalNotesDraft, notesDraft, onNotify, role]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-100 rounded-lg" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
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
  const kanbanColor = DEAL_KANBAN_COLUMNS.find((c) => c.status === derivedKanbanStatus)?.color
    || 'bg-slate-100 text-slate-700';
  const timelineRole = role === 'admin' ? 'seller' : role;
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-slate-600 hover:text-reride-orange"
        >
          ← Back
        </button>
        <span className="text-[10px] font-mono font-bold text-reride-orange">{deal.id}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${kanbanColor}`}>
          {dealKanbanLabel(derivedKanbanStatus)}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
          {dealStageLabel(deal.currentStage)}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{vehicle}</h2>
            {deal.vehiclePrice != null && (
              <p className="text-sm text-slate-500 mt-1">
                Listed at ₹{deal.vehiclePrice.toLocaleString('en-IN')}
              </p>
            )}
            {deal.metadata.acceptedOfferAmount && (
              <p className="text-sm font-semibold text-emerald-700 mt-1">
                Accepted offer: ₹{deal.metadata.acceptedOfferAmount.toLocaleString('en-IN')}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
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

          <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Deal pipeline</h3>
            <DealTimelinePanel
              lead={deal}
              currentUser={currentUser}
              currentUserRole={timelineRole}
              onLeadUpdated={(updated) => setDeal((prev) => (prev ? { ...prev, ...updated } : prev))}
              conversationId={deal.conversationId}
            />
          </div>

          {timelineForDisplay.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Activity log</h3>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {[...timelineForDisplay].reverse().map((evt) => (
                  <li key={evt.id} className="flex gap-2 text-xs text-slate-600">
                    <span className="text-emerald-600 shrink-0">●</span>
                    <span className="flex-1">{evt.label || evt.stage}</span>
                    <span className="text-slate-400 shrink-0">
                      {new Date(evt.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Parties</h3>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Buyer</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{buyer}</p>
              <p className="text-xs text-slate-500">{deal.buyerEmail}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Seller</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{seller}</p>
              <p className="text-xs text-slate-500">{deal.sellerEmail}</p>
            </div>
            {deal.assignedAdminEmail && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Assigned admin</p>
                <p className="text-xs text-slate-600">{deal.assignedAdminEmail}</p>
              </div>
            )}
          </div>

          {(deal.offers?.length || deal.documents?.length || bookings.length > 0) ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
              {bookings.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Inspection bookings</h3>
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
              {deal.offers && deal.offers.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Offers</h3>
                  <ul className="space-y-1">
                    {deal.offers.map((o) => (
                      <li key={o.id} className="text-xs flex justify-between gap-2">
                        <span>₹{o.amount.toLocaleString('en-IN')} · {o.offeredBy}</span>
                        <span className="text-slate-500">{o.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {deal.documents && deal.documents.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Documents</h3>
                  <ul className="space-y-1">
                    {deal.documents.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-reride-orange hover:underline"
                        >
                          {d.docType.replace(/_/g, ' ')}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {showSellerNotes && (
            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Seller notes</h3>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                placeholder="Private notes about this deal…"
                className="w-full text-sm border border-slate-200 rounded-lg p-2 resize-none dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
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
                  Save notes
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
            </div>
          )}

          {(showSellerNotes || showInternalNotes) && (
            <button
              type="button"
              disabled={savingNotes}
              onClick={() => void handleSaveNotes()}
              className="w-full py-2 text-sm font-bold rounded-xl bg-slate-900 text-white disabled:opacity-50"
            >
              {savingNotes ? 'Saving…' : 'Save notes'}
            </button>
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
