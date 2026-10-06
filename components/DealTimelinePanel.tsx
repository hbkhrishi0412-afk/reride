import React, { useCallback, useRef, useState } from 'react';
import type { DealLead, DealStage, User } from '../types.js';
import { DEAL_TIMELINE_STAGES, DEAL_ASSISTANCE_PACKAGES, DEAL_PIPELINE_STAGES } from '../types.js';
import {
  advanceDealStage,
  respondToDealOffer,
  acceptDealChat,
  confirmDealAssistancePayment,
  purchaseDealAssistance,
  getDealLead,
} from '../services/dealService.js';
import { uploadImage } from '../services/imageUploadService.js';
import {
  openRazorpayDealAssistanceCheckout,
  isRazorpayConfiguredInClient,
} from '../services/razorpayPlanPayment.js';

interface DealTimelinePanelProps {
  lead: DealLead;
  currentUser: User;
  currentUserRole: 'customer' | 'seller';
  onLeadUpdated: (lead: DealLead) => void;
  conversationId?: string;
  onSendPipelineMessage?: (
    messageText: string,
    type?: 'text' | 'offer' | 'test_drive_request',
    payload?: Record<string, unknown>,
  ) => void | Promise<void>;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

function notifyUser(
  onNotify: DealTimelinePanelProps['onNotify'],
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'error',
) {
  if (onNotify) {
    onNotify(message, type);
    return;
  }
  if (typeof window !== 'undefined') {
    window.alert(message);
  }
}

const PIPELINE_STAGE_ORDER: DealStage[] = [...DEAL_PIPELINE_STAGES];

function stageIndex(stage: DealStage): number {
  return PIPELINE_STAGE_ORDER.indexOf(stage);
}

function isPipelineTimelineEvent(eventType: string): boolean {
  return eventType !== 'kanban_moved' && eventType !== 'assistance_purchased';
}

function getEffectiveStageIndex(lead: DealLead): number {
  const current = stageIndex(lead.currentStage);
  const fromTimeline = (lead.timeline || []).reduce((max, event) => {
    if (!isPipelineTimelineEvent(String(event.eventType || ''))) return max;
    const idx = stageIndex(event.stage as DealStage);
    return idx > max ? idx : max;
  }, -1);
  return Math.max(current, fromTimeline);
}

function isStageDone(effectiveIndex: number, stage: DealStage): boolean {
  return effectiveIndex >= stageIndex(stage);
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

const btnPrimary =
  'px-3 py-2 text-xs font-semibold rounded-lg bg-reride-orange text-white hover:bg-orange-600 disabled:opacity-50';
const btnSecondary =
  'px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const amountInput =
  'min-w-0 flex-1 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-200';

export const DealTimelinePanel: React.FC<DealTimelinePanelProps> = ({
  lead,
  currentUser,
  currentUserRole,
  onLeadUpdated,
  conversationId,
  onSendPipelineMessage,
  onNotify,
}) => {
  const [loading, setLoading] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [counterAmount, setCounterAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [showAssistance, setShowAssistance] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<'token' | 'saleAgreement' | 'deliveryNote' | 'rc' | 'inspection' | null>(null);

  const isSeller = currentUserRole === 'seller';
  const isBuyer = currentUserRole === 'customer';
  const effectiveStageIndex = getEffectiveStageIndex(lead);
  const currentOffer = lead.metadata.offers?.find((o) => o.id === lead.metadata.currentOfferId);
  const pendingOffer = currentOffer?.status === 'pending' ? currentOffer : undefined;

  const handleAdvance = useCallback(
    async (stage: DealStage, payload?: Record<string, unknown>, label?: string): Promise<DealLead | null> => {
      setLoading(true);
      try {
        const updated = await advanceDealStage(lead.id, stage, payload, label);
        onLeadUpdated(updated);
        if (stage !== 'offer_made') {
          const latest = updated.timeline?.[updated.timeline.length - 1]?.label;
          void onSendPipelineMessage?.(`Deal update: ${latest || label || stage.replace(/_/g, ' ')}`);
        }
        return updated;
      } catch (err) {
        notifyUser(onNotify, err instanceof Error ? err.message : 'Action failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [lead.id, onLeadUpdated, onNotify, onSendPipelineMessage],
  );

  const handleAcceptChat = async () => {
    setLoading(true);
    try {
      const updated = await acceptDealChat(lead.id, conversationId);
      onLeadUpdated(updated);
      void onSendPipelineMessage?.('Deal update: Seller accepted the chat. You can message now.');
    } catch (err) {
      notifyUser(onNotify, err instanceof Error ? err.message : 'Failed to accept chat');
    } finally {
      setLoading(false);
    }
  };

  const handleOfferResponse = async (response: 'accepted' | 'rejected' | 'countered') => {
    setLoading(true);
    try {
      const updated = await respondToDealOffer(
        lead.id,
        response,
        response === 'countered' ? Number(counterAmount) : undefined,
      );
      onLeadUpdated(updated);
      if (response === 'countered' && counterAmount) {
        onSendPipelineMessage?.('Counter offer sent via Deal Room.', 'offer', {
          offerPrice: Number(counterAmount),
          counterPrice: currentOffer?.amount,
          status: 'pending',
          dealOfferId: updated.metadata.currentOfferId,
        });
      } else if (response === 'accepted' && currentOffer?.amount) {
        onSendPipelineMessage?.(`Offer accepted: ${formatCurrency(currentOffer.amount)}`);
      } else if (response === 'rejected' && currentOffer?.amount) {
        onSendPipelineMessage?.(`Offer rejected: ${formatCurrency(currentOffer.amount)}`);
      }
      setCounterAmount('');
    } catch (err) {
      notifyUser(onNotify, err instanceof Error ? err.message : 'Offer response failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setLoading(true);
    try {
      const result = await uploadImage(file, 'deal-documents', currentUser.email);
      if (!result.success || !result.url) throw new Error(result.error || 'Upload failed');

      switch (uploadTarget) {
        case 'token':
          await handleAdvance('token_uploaded', { receiptUrl: result.url, amount: Number(tokenAmount) || undefined });
          break;
        case 'saleAgreement':
          await handleAdvance('documents_pending', { saleAgreementUrl: result.url });
          break;
        case 'deliveryNote':
          await handleAdvance('documents_pending', { deliveryNoteUrl: result.url });
          break;
        case 'rc':
          await handleAdvance('rc_pending', { transferDocUrl: result.url });
          break;
        case 'inspection':
          await handleAdvance('inspection_completed', { reportUrl: result.url });
          break;
      }
    } catch (err) {
      notifyUser(onNotify, err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = (target: typeof uploadTarget) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleAssistancePurchase = async (packageId: string, packageName: string, price: number) => {
    setLoading(true);
    try {
      if (isRazorpayConfiguredInClient()) {
        await new Promise<void>((resolve, reject) => {
          openRazorpayDealAssistanceCheckout({
            leadId: lead.id,
            packageId,
            packageName,
            amountInr: price,
            payerEmail: currentUser.email,
            payerName: currentUser.name,
            onSuccess: async (proof) => {
              try {
                await confirmDealAssistancePayment({
                  leadId: lead.id,
                  packageId,
                  amount: price,
                  razorpay_order_id: proof.razorpay_order_id,
                  razorpay_payment_id: proof.razorpay_payment_id,
                  razorpay_signature: proof.razorpay_signature,
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onFailure: (msg) => reject(new Error(msg)),
          });
        });
      } else {
        await purchaseDealAssistance(lead.id, packageId);
      }
      const updated = await getDealLead({ leadId: lead.id });
      if (updated) onLeadUpdated(updated);
      setShowAssistance(false);
      notifyUser(onNotify, 'Assistance package purchased! Our team will contact you shortly.', 'success');
    } catch (err) {
      notifyUser(onNotify, err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  if (lead.status === 'completed') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-3">
        <p className="font-bold text-green-800 text-center">🎉 Congratulations! Deal Completed</p>
        <p className="text-sm text-green-700 text-center mt-1">Lead ID: {lead.id}</p>
      </div>
    );
  }

  const eventLabelByStage = new Map<string, string>();
  for (const e of lead.timeline || []) {
    if (e.label && isPipelineTimelineEvent(String(e.eventType || ''))) eventLabelByStage.set(e.stage, e.label);
  }
  const doneCount = DEAL_TIMELINE_STAGES.filter(({ stage }) => isStageDone(effectiveStageIndex, stage)).length;
  const nextStep = DEAL_TIMELINE_STAGES.find(({ stage }) => !isStageDone(effectiveStageIndex, stage));
  const progressPct = Math.round((doneCount / DEAL_TIMELINE_STAGES.length) * 100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 mb-3 shadow-sm">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">
            Step {Math.min(doneCount + 1, DEAL_TIMELINE_STAGES.length)} of {DEAL_TIMELINE_STAGES.length} · {lead.id}
          </p>
          {nextStep && (
            <p className="text-sm font-semibold text-slate-800 truncate">Next: {nextStep.label}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-green-700">{progressPct}%</span>
      </div>

      <div
        className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-3"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Deal progress"
      >
        <div className="h-full bg-green-500 transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <section aria-label="Your action" className="rounded-lg border border-orange-100 bg-orange-50/60 p-2.5 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-reride-orange mb-2">Your action</p>
        <div className="peer flex flex-col gap-2">
          {lead.chatStatus === 'pending' && isSeller && (
            <button onClick={handleAcceptChat} disabled={loading} className={btnPrimary}>
              Accept Chat
            </button>
          )}
          {lead.chatStatus === 'accepted' && (
            <>
          {!isStageDone(effectiveStageIndex, 'offer_accepted') && (
            <>
              {isBuyer && !pendingOffer && (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Your offer ₹"
                    aria-label="Offer amount in rupees"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className={amountInput}
                  />
                  <button
                    disabled={loading || !offerAmount}
                    onClick={async () => {
                      const amount = Number(offerAmount);
                      const updated = await handleAdvance('offer_made', { amount });
                      if (!updated) return;
                      onSendPipelineMessage?.('Offer sent via Deal Room.', 'offer', {
                        offerPrice: amount,
                        status: 'pending',
                        dealOfferId: updated.metadata.currentOfferId,
                      });
                      setOfferAmount('');
                    }}
                    className={btnPrimary}
                  >
                    Make Offer
                  </button>
                </div>
              )}
              {pendingOffer && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    Offer from {pendingOffer.offeredBy}:{' '}
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(pendingOffer.amount)}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleOfferResponse('accepted')} disabled={loading} className="px-3 py-2 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Accept</button>
                    <button onClick={() => handleOfferResponse('rejected')} disabled={loading} className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="number" inputMode="numeric" placeholder="Counter offer ₹" aria-label="Counter offer amount in rupees" value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)} className={amountInput} />
                    <button onClick={() => handleOfferResponse('countered')} disabled={loading || !counterAmount} className={btnSecondary}>Counter</button>
                  </div>
                </div>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'offer_accepted') && !isStageDone(effectiveStageIndex, 'inspection_completed') && isBuyer && (
            <>
              {!lead.metadata.inspection?.requestedAt && (
                <button onClick={() => handleAdvance('inspection_requested')} disabled={loading} className={btnPrimary}>
                  Need Inspection
                </button>
              )}
              {lead.metadata.inspection?.requestedAt && !lead.metadata.inspection?.completedAt && (
                <button onClick={() => triggerUpload('inspection')} disabled={loading} className={btnPrimary}>
                  Upload Inspection Report
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'inspection_completed') && !isStageDone(effectiveStageIndex, 'test_drive_scheduled') && isBuyer && (
            <p className="text-xs text-slate-600">
              Request a test drive from the listing page. Once the seller confirms it in chat, it appears here.
            </p>
          )}

          {isStageDone(effectiveStageIndex, 'test_drive_scheduled') && !isStageDone(effectiveStageIndex, 'test_drive_completed') && isBuyer && (
            <button
              disabled={loading}
              onClick={() => handleAdvance('test_drive_completed')}
              className={btnPrimary}
            >
              Test Drive Completed
            </button>
          )}

          {isStageDone(effectiveStageIndex, 'test_drive_completed') && !isStageDone(effectiveStageIndex, 'token_confirmed') && (
            <>
              {isBuyer && !lead.metadata.token?.receiptUrl && (
                <div className="flex gap-2 items-center">
                  <input type="number" inputMode="numeric" placeholder="Token amount ₹" aria-label="Token amount in rupees" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} className={amountInput} />
                  <button onClick={() => triggerUpload('token')} disabled={loading} className={btnPrimary}>
                    Upload Token Receipt
                  </button>
                </div>
              )}
              {isSeller && lead.metadata.token?.receiptUrl && !lead.metadata.token?.confirmedAt && (
                <button onClick={() => handleAdvance('token_confirmed')} disabled={loading} className={btnPrimary}>
                  Yes, Token Received
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'token_confirmed') && !isStageDone(effectiveStageIndex, 'delivery_completed') && (
            <>
              {isBuyer && !lead.metadata.delivery?.buyerConfirmedAt && (
                <button onClick={() => handleAdvance('delivery_pending')} disabled={loading} className={btnPrimary}>
                  Vehicle Received
                </button>
              )}
              {isSeller && !lead.metadata.delivery?.sellerConfirmedAt && (
                <button onClick={() => handleAdvance('delivery_pending')} disabled={loading} className={btnPrimary}>
                  Vehicle Delivered
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'delivery_completed') && !isStageDone(effectiveStageIndex, 'documents_completed') && (
            <>
              {isBuyer && !lead.metadata.documents?.saleAgreementUrl && (
                <button onClick={() => triggerUpload('saleAgreement')} disabled={loading} className={btnPrimary}>
                  Upload Sale Agreement
                </button>
              )}
              {isSeller && !lead.metadata.documents?.deliveryNoteUrl && (
                <button onClick={() => triggerUpload('deliveryNote')} disabled={loading} className={btnPrimary}>
                  Upload Signed Delivery Note
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'documents_completed') && !isStageDone(effectiveStageIndex, 'rc_completed') && (
            <>
              {isSeller && !lead.metadata.rc?.transferDocUrl && (
                <button onClick={() => triggerUpload('rc')} disabled={loading} className={btnPrimary}>
                  Upload RC Transfer Doc
                </button>
              )}
              {isBuyer && lead.metadata.rc?.transferDocUrl && !lead.metadata.rc?.buyerConfirmedAt && (
                <button onClick={() => handleAdvance('rc_completed')} disabled={loading} className={btnPrimary}>
                  Confirm RC Transfer
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'rc_completed') && !isStageDone(effectiveStageIndex, 'deal_completed') && (
            <button onClick={() => handleAdvance('deal_completed')} disabled={loading} className="px-3 py-2 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              Complete Deal
            </button>
          )}
            </>
          )}
        </div>
        <p className="hidden peer-empty:block text-xs text-slate-600">
          Nothing needed from you right now. Waiting for the {isBuyer ? 'seller' : 'buyer'}.
        </p>
      </section>

      <details className="mb-2">
        <summary className="cursor-pointer select-none text-xs font-medium text-slate-500 hover:text-slate-700">
          View all steps ({doneCount}/{DEAL_TIMELINE_STAGES.length} done)
        </summary>
        <ol className="mt-2 space-y-1">
          {DEAL_TIMELINE_STAGES.map(({ stage, label }) => {
            const done = isStageDone(effectiveStageIndex, stage);
            return (
              <li key={stage} className="flex items-center gap-2 text-xs">
                <span className={done ? 'text-green-600' : 'text-slate-300'} aria-hidden>{done ? '✓' : '○'}</span>
                <span className={done ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  {eventLabelByStage.get(stage) || label}
                </span>
              </li>
            );
          })}
        </ol>
      </details>

      {lead.chatStatus === 'accepted' && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <span className="text-[11px] text-slate-500">Stuck on paperwork or RC?</span>
          <button
            onClick={() => setShowAssistance(!showAssistance)}
            aria-expanded={showAssistance}
            className="text-xs font-semibold text-reride-orange hover:underline"
          >
            {showAssistance ? 'Hide help' : 'Need Help?'}
          </button>
        </div>
      )}

      {showAssistance && (
        <div className="mt-2 p-2 bg-amber-50 rounded-lg space-y-1">
          <p className="text-xs font-bold text-amber-900">Deal Assistance</p>
          {DEAL_ASSISTANCE_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handleAssistancePurchase(pkg.id, pkg.name, pkg.price)}
              disabled={loading}
              className="w-full text-left px-2 py-1.5 text-xs bg-white rounded border hover:border-reride-orange flex justify-between"
            >
              <span>{pkg.name}</span>
              <span className="font-bold">{formatCurrency(pkg.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DealTimelinePanel;
