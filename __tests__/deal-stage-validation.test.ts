import { DEAL_PIPELINE_STAGES, pipelineStageIndex } from '../types';
import { validateAdvanceStage } from '../server/handlers/deals/stage-validation';

const buyerAuth = { email: 'buyer@test.com' };
const sellerAuth = { email: 'seller@test.com' };

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    buyer_email: 'buyer@test.com',
    seller_email: 'seller@test.com',
    chat_status: 'accepted',
    current_stage: 'test_drive_completed',
    metadata: {},
    ...overrides,
  };
}

describe('DEAL_PIPELINE_STAGES order', () => {
  it('places inspection before negotiation and offer acceptance', () => {
    expect(pipelineStageIndex('inspection_completed')).toBeLessThan(pipelineStageIndex('offer_made'));
    expect(pipelineStageIndex('offer_made')).toBeLessThan(pipelineStageIndex('offer_accepted'));
    expect(pipelineStageIndex('offer_accepted')).toBeLessThan(pipelineStageIndex('token_uploaded'));
  });

  it('matches the documented pipeline sequence', () => {
    const inspectionIdx = DEAL_PIPELINE_STAGES.indexOf('inspection_completed');
    const offerMadeIdx = DEAL_PIPELINE_STAGES.indexOf('offer_made');
    const offerAcceptedIdx = DEAL_PIPELINE_STAGES.indexOf('offer_accepted');
    expect(inspectionIdx).toBeGreaterThan(-1);
    expect(offerMadeIdx).toBe(inspectionIdx + 1);
    expect(offerAcceptedIdx).toBe(offerMadeIdx + 1);
  });
});

describe('validateAdvanceStage — inspection before offers', () => {
  it('allows inspection request after chat without an accepted offer', () => {
    const err = validateAdvanceStage({
      stage: 'inspection_requested',
      row: baseRow({ current_stage: 'test_drive_completed' }),
      auth: buyerAuth,
      payload: {},
    });
    expect(err).toBeNull();
  });

  it('blocks offers until inspection is completed', () => {
    const err = validateAdvanceStage({
      stage: 'offer_made',
      row: baseRow({ current_stage: 'inspection_requested', metadata: { inspection: { requestedAt: '2026-01-01' } } }),
      auth: buyerAuth,
      payload: { amount: 250000 },
    });
    expect(err).toMatch(/inspection must be completed/i);
  });

  it('allows offers after inspection is completed', () => {
    const err = validateAdvanceStage({
      stage: 'offer_made',
      row: baseRow({
        current_stage: 'inspection_completed',
        metadata: { inspection: { requestedAt: '2026-01-01', completedAt: '2026-01-02' } },
      }),
      auth: buyerAuth,
      payload: { amount: 250000 },
    });
    expect(err).toBeNull();
  });

  it('blocks token upload until offer is accepted', () => {
    const err = validateAdvanceStage({
      stage: 'token_uploaded',
      row: baseRow({ current_stage: 'inspection_completed' }),
      auth: buyerAuth,
      payload: { receiptUrl: 'https://example.com/receipt.pdf' },
    });
    expect(err).toMatch(/offer must be accepted/i);
  });

  it('allows token upload after offer acceptance', () => {
    const err = validateAdvanceStage({
      stage: 'token_uploaded',
      row: baseRow({ current_stage: 'offer_accepted' }),
      auth: buyerAuth,
      payload: { receiptUrl: 'https://example.com/receipt.pdf' },
    });
    expect(err).toBeNull();
  });

  it('restricts inspection completion to the buyer', () => {
    const err = validateAdvanceStage({
      stage: 'inspection_completed',
      row: baseRow({
        current_stage: 'inspection_requested',
        metadata: { inspection: { requestedAt: '2026-01-01' } },
      }),
      auth: sellerAuth,
      payload: {},
    });
    expect(err).toMatch(/only the buyer/i);
  });
});
