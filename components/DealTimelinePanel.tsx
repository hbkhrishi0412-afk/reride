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
    async (stage: DealStage, payload?: Record<string, unknown>, label?: string) => {
      setLoading(true);
      try {
        const updated = await advanceDealStage(lead.id, stage, payload, label);
        onLeadUpdated(updated);
      } catch (err) {
        notifyUser(onNotify, err instanceof Error ? err.message : 'Action failed');
      } finally {
        setLoading(false);
      }
    },
    [lead.id, onLeadUpdated],
  );

  const handleAcceptChat = async () => {
    setLoading(true);
    try {
      const updated = await acceptDealChat(lead.id, conversationId);
      onLeadUpdated(updated);
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:bg-brand-gray-800 p-3 mb-3 shadow-sm">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />

      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-reride-orange uppercase tracking-wide">Deal Pipeline</p>
          <p className="text-sm font-bold text-reride-text-dark dark:text-white">{lead.id}</p>
        </div>
        {lead.chatStatus === 'pending' && isSeller && (
          <button
            onClick={handleAcceptChat}
            disabled={loading}
            className="px-3 py-1.5 bg-reride-orange text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            Accept Chat?
          </button>
        )}
        {lead.chatStatus === 'pending' && isBuyer && (
          <span className="text-xs text-amber-600 font-medium">Waiting for seller...</span>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
        {DEAL_TIMELINE_STAGES.map(({ stage, label }) => {
          const done = isStageDone(effectiveStageIndex, stage);
          const event = [...(lead.timeline || [])]
            .reverse()
            .find((e) => e.stage === stage && isPipelineTimelineEvent(String(e.eventType || '')));
          return (
            <div key={stage} className="flex items-center gap-2 text-xs">
              <span className={done ? 'text-green-600' : 'text-slate-300'}>{done ? '✓' : '○'}</span>
              <span className={done ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                {event?.label || label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action buttons based on stage */}
      {lead.chatStatus === 'accepted' && (
        <div className="flex flex-wrap gap-2">
          {!isStageDone(effectiveStageIndex, 'test_drive_completed') && isBuyer && (
            <button
              disabled={loading}
              onClick={async () => {
                await handleAdvance('test_drive_completed');
                onSendPipelineMessage?.('Test drive marked as completed.');
              }}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-lg font-medium hover:bg-blue-200"
            >
              Test Drive Completed
            </button>
          )}

          {isStageDone(effectiveStageIndex, 'test_drive_completed') && !isStageDone(effectiveStageIndex, 'offer_accepted') && (
            <>
              {isBuyer && !pendingOffer && (
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    placeholder="Offer ₹"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="w-24 px-2 py-1 text-xs border rounded"
                  />
                  <button
                    disabled={loading || !offerAmount}
                    onClick={async () => {
                      const amount = Number(offerAmount);
                      await handleAdvance('offer_made', { amount });
                      onSendPipelineMessage?.('Offer sent via Deal Room.', 'offer', {
                        offerPrice: amount,
                        status: 'pending',
                      });
                      setOfferAmount('');
                    }}
                    className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-lg font-medium"
                  >
                    Make Offer
                  </button>
                </div>
              )}
              {pendingOffer && (
                <div className="w-full space-y-1">
                  <p className="text-xs font-semibold">
                    Offer: {formatCurrency(pendingOffer.amount)} from {pendingOffer.offeredBy}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => handleOfferResponse('accepted')} disabled={loading} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-lg">Accept</button>
                    <button onClick={() => handleOfferResponse('rejected')} disabled={loading} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-lg">Reject</button>
                    <input type="number" placeholder="Counter ₹" value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)} className="w-20 px-1 py-1 text-xs border rounded" />
                    <button onClick={() => handleOfferResponse('countered')} disabled={loading || !counterAmount} className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-lg">Counter</button>
                  </div>
                </div>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'offer_accepted') && !isStageDone(effectiveStageIndex, 'inspection_completed') && isBuyer && (
            <>
              {!lead.metadata.inspection?.requestedAt && (
                <button onClick={() => handleAdvance('inspection_requested')} disabled={loading} className="px-2 py-1 text-xs bg-teal-100 text-teal-800 rounded-lg font-medium">
                  Need Inspection
                </button>
              )}
              {lead.metadata.inspection?.requestedAt && !lead.metadata.inspection?.completedAt && (
                <button onClick={() => triggerUpload('inspection')} disabled={loading} className="px-2 py-1 text-xs bg-teal-100 text-teal-800 rounded-lg font-medium">
                  Upload Inspection Report
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'inspection_completed') && !isStageDone(effectiveStageIndex, 'token_confirmed') && (
            <>
              {isBuyer && !lead.metadata.token?.receiptUrl && (
                <div className="flex gap-1 items-center">
                  <input type="number" placeholder="Token ₹" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} className="w-20 px-1 py-1 text-xs border rounded" />
                  <button onClick={() => triggerUpload('token')} disabled={loading} className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-lg font-medium">
                    Upload Token Receipt
                  </button>
                </div>
              )}
              {isSeller && lead.metadata.token?.receiptUrl && !lead.metadata.token?.confirmedAt && (
                <button onClick={() => handleAdvance('token_confirmed')} disabled={loading} className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-lg font-medium">
                  Yes, Token Received
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'token_confirmed') && !isStageDone(effectiveStageIndex, 'delivery_completed') && (
            <>
              {isBuyer && !lead.metadata.delivery?.buyerConfirmedAt && (
                <button onClick={() => handleAdvance('delivery_pending')} disabled={loading} className="px-2 py-1 text-xs bg-cyan-100 text-cyan-800 rounded-lg font-medium">
                  Vehicle Received
                </button>
              )}
              {isSeller && !lead.metadata.delivery?.sellerConfirmedAt && (
                <button onClick={() => handleAdvance('delivery_pending')} disabled={loading} className="px-2 py-1 text-xs bg-cyan-100 text-cyan-800 rounded-lg font-medium">
                  Vehicle Delivered
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'delivery_completed') && !isStageDone(effectiveStageIndex, 'documents_completed') && (
            <>
              {isBuyer && !lead.metadata.documents?.saleAgreementUrl && (
                <button onClick={() => triggerUpload('saleAgreement')} disabled={loading} className="px-2 py-1 text-xs bg-slate-100 text-slate-800 rounded-lg font-medium">
                  Upload Sale Agreement
                </button>
              )}
              {isSeller && !lead.metadata.documents?.deliveryNoteUrl && (
                <button onClick={() => triggerUpload('deliveryNote')} disabled={loading} className="px-2 py-1 text-xs bg-slate-100 text-slate-800 rounded-lg font-medium">
                  Upload Signed Delivery Note
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'documents_completed') && !isStageDone(effectiveStageIndex, 'rc_completed') && (
            <>
              {isSeller && !lead.metadata.rc?.transferDocUrl && (
                <button onClick={() => triggerUpload('rc')} disabled={loading} className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-lg font-medium">
                  Upload RC Transfer Doc
                </button>
              )}
              {isBuyer && lead.metadata.rc?.transferDocUrl && !lead.metadata.rc?.buyerConfirmedAt && (
                <button onClick={() => handleAdvance('rc_completed')} disabled={loading} className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-lg font-medium">
                  Confirm RC Transfer
                </button>
              )}
            </>
          )}

          {isStageDone(effectiveStageIndex, 'rc_completed') && !isStageDone(effectiveStageIndex, 'deal_completed') && (
            <button onClick={() => handleAdvance('deal_completed')} disabled={loading} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg font-bold">
              Complete Deal
            </button>
          )}

          <button onClick={() => setShowAssistance(!showAssistance)} className="px-2 py-1 text-xs border border-reride-orange text-reride-orange rounded-lg font-medium ml-auto">
            Need Help?
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
