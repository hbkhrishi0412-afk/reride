import type { DealLeadMetadata, DealStage } from '../../../types.js';
import { DEAL_PIPELINE_STAGES, pipelineStageIndex } from '../../../types.js';

const VALID_DEAL_STAGES = new Set<string>(DEAL_PIPELINE_STAGES);

const ADVANCE_BLOCKED_STAGES = new Set<DealStage>(['lead_created', 'chat_accepted', 'offer_accepted']);

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Server-side guard for advance-stage — mirrors UI prerequisites. Admins bypass checks. */
export function validateAdvanceStage(params: {
  stage: DealStage;
  row: Record<string, unknown>;
  auth: { email: string; role?: string };
  payload: Record<string, unknown>;
}): string | null {
  const { stage, row, auth, payload } = params;
  if (!VALID_DEAL_STAGES.has(stage)) return 'Invalid stage';
  if (ADVANCE_BLOCKED_STAGES.has(stage)) return 'This stage cannot be set directly';

  if (auth.role === 'admin') return null;

  const buyerEmail = normalizeEmail(String(row.buyer_email));
  const sellerEmail = normalizeEmail(String(row.seller_email));
  const isBuyer = auth.email === buyerEmail;
  const isSeller = auth.email === sellerEmail;
  const chatStatus = String(row.chat_status || '');
  const currentStage = String(row.current_stage || 'lead_created') as DealStage;
  const metadata = (row.metadata as DealLeadMetadata) || {};

  if (chatStatus !== 'accepted') {
    return 'Chat must be accepted before advancing the deal';
  }

  switch (stage) {
    case 'test_drive_scheduled':
      if (pipelineStageIndex(currentStage) < pipelineStageIndex('inspection_completed')) {
        return 'Inspection must be completed before scheduling a test drive';
      }
      break;
    case 'test_drive_completed':
      if (!isBuyer) return 'Only the buyer can mark test drive completed';
      if (pipelineStageIndex(currentStage) < pipelineStageIndex('test_drive_scheduled')) {
        return 'Test drive must be scheduled first';
      }
      break;
    case 'offer_made': {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return 'Valid offer amount is required';
      if (pipelineStageIndex(currentStage) < pipelineStageIndex('chat_accepted')) {
        return 'Chat must be started before making an offer';
      }
      break;
    }
    case 'inspection_requested':
      if (!isBuyer) return 'Only the buyer can request inspection';
      if (pipelineStageIndex(currentStage) < pipelineStageIndex('offer_accepted')) {
        return 'Price must be agreed before requesting inspection';
      }
      break;
    case 'inspection_completed':
      if (!isBuyer) return 'Only the buyer can complete inspection';
      if (!metadata.inspection?.requestedAt) return 'Inspection must be requested first';
      break;
    case 'token_uploaded':
      if (!isBuyer) return 'Only the buyer can upload token receipt';
      if (!payload.receiptUrl) return 'Token receipt is required';
      if (pipelineStageIndex(currentStage) < pipelineStageIndex('test_drive_completed')) {
        return 'Test drive must be completed before uploading token';
      }
      break;
    case 'token_confirmed':
      if (!isSeller) return 'Only the seller can confirm token';
      if (!metadata.token?.receiptUrl) return 'Token receipt must be uploaded first';
      break;
    case 'delivery_pending':
      if (!isBuyer && !isSeller) return 'Not authorized';
      break;
    case 'delivery_completed':
      if (!metadata.delivery?.buyerConfirmedAt || !metadata.delivery?.sellerConfirmedAt) {
        return 'Both parties must confirm delivery';
      }
      break;
    case 'documents_pending':
      if (isBuyer && !payload.saleAgreementUrl) return 'Sale agreement is required';
      if (isSeller && !payload.deliveryNoteUrl) return 'Delivery note is required';
      if (!isBuyer && !isSeller) return 'Not authorized';
      if (pipelineStageIndex(currentStage) < pipelineStageIndex('delivery_completed')) {
        return 'Delivery must be completed first';
      }
      break;
    case 'documents_completed':
      if (!metadata.documents?.saleAgreementUrl || !metadata.documents?.deliveryNoteUrl) {
        return 'Both documents must be uploaded';
      }
      break;
    case 'rc_pending':
      if (!isSeller) return 'Only the seller can upload RC transfer documents';
      if (!payload.transferDocUrl) return 'RC transfer document is required';
      break;
    case 'rc_completed':
      if (!isBuyer) return 'Only the buyer can confirm RC transfer';
      if (!metadata.rc?.transferDocUrl) return 'RC transfer document must be uploaded first';
      break;
    case 'deal_completed':
      if (pipelineStageIndex(currentStage) < pipelineStageIndex('rc_completed')) {
        return 'RC transfer must be completed before closing the deal';
      }
      break;
    default:
      break;
  }
  return null;
}
