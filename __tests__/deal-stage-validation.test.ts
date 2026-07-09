import { DEAL_PIPELINE_STAGES, pipelineStageIndex } from '../types';
import { validateAdvanceStage } from '../server/handlers/deals/stage-validation';

const buyerAuth = { email: 'buyer@test.com' };
const sellerAuth = { email: 'seller@test.com' };

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    buyer_email: 'buyer@test.com',
    seller_email: 'seller@test.com',
    chat_status: 'accepted',
    current_stage: 'chat_accepted',
    metadata: {},
    ...overrides,
  };
}

describe('DEAL_PIPELINE_STAGES order', () => {
  it('places negotiation before inspection and test drive', () => {
    expect(pipelineStageIndex('chat_accepted')).toBeLessThan(pipelineStageIndex('offer_made'));
    expect(pipelineStageIndex('offer_accepted')).toBeLessThan(pipelineStageIndex('inspection_completed'));
    expect(pipelineStageIndex('inspection_completed')).toBeLessThan(pipelineStageIndex('test_drive_scheduled'));
    expect(pipelineStageIndex('test_drive_completed')).toBeLessThan(pipelineStageIndex('token_uploaded'));
  });

  it('matches the documented pipeline sequence', () => {
    const chatIdx = DEAL_PIPELINE_STAGES.indexOf('chat_accepted');
    const offerMadeIdx = DEAL_PIPELINE_STAGES.indexOf('offer_made');
    const offerAcceptedIdx = DEAL_PIPELINE_STAGES.indexOf('offer_accepted');
    const inspectionIdx = DEAL_PIPELINE_STAGES.indexOf('inspection_completed');
    const testDriveIdx = DEAL_PIPELINE_STAGES.indexOf('test_drive_completed');
    expect(offerMadeIdx).toBe(chatIdx + 1);
    expect(offerAcceptedIdx).toBe(offerMadeIdx + 1);
    expect(inspectionIdx).toBeGreaterThan(offerAcceptedIdx);
    expect(testDriveIdx).toBeGreaterThan(inspectionIdx);
  });
});

describe('validateAdvanceStage — negotiation before inspection', () => {
  it('allows offers after chat is accepted', () => {
    const err = validateAdvanceStage({
      stage: 'offer_made',
      row: baseRow({ current_stage: 'chat_accepted' }),
      auth: buyerAuth,
      payload: { amount: 250000 },
    });
    expect(err).toBeNull();
  });

  it('blocks inspection until price is agreed', () => {
    const err = validateAdvanceStage({
      stage: 'inspection_requested',
      row: baseRow({ current_stage: 'offer_made' }),
      auth: buyerAuth,
      payload: {},
    });
    expect(err).toMatch(/price must be agreed/i);
  });

  it('allows inspection after negotiation is complete', () => {
    const err = validateAdvanceStage({
      stage: 'inspection_requested',
      row: baseRow({ current_stage: 'offer_accepted' }),
      auth: buyerAuth,
      payload: {},
    });
    expect(err).toBeNull();
  });

  it('blocks test drive scheduling until inspection is completed', () => {
    const err = validateAdvanceStage({
      stage: 'test_drive_scheduled',
      row: baseRow({ current_stage: 'offer_accepted' }),
      auth: buyerAuth,
      payload: { date: '2026-07-15', time: '10:00' },
    });
    expect(err).toMatch(/inspection must be completed/i);
  });

  it('blocks token upload until test drive is completed', () => {
    const err = validateAdvanceStage({
      stage: 'token_uploaded',
      row: baseRow({ current_stage: 'offer_accepted' }),
      auth: buyerAuth,
      payload: { receiptUrl: 'https://example.com/receipt.pdf' },
    });
    expect(err).toMatch(/test drive must be completed/i);
  });

  it('allows token upload after test drive completion', () => {
    const err = validateAdvanceStage({
      stage: 'token_uploaded',
      row: baseRow({ current_stage: 'test_drive_completed' }),
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
