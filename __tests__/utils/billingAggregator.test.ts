import { PRICING } from '@/constants/pricing';
import { BillingAggregator } from '@/utils/ingestion/BillingAggregator';
import { buildNormalizedRowFromProcessedData } from '@/utils/ingestion/analytics';
import { buildBillingArtifactsFromProcessedData } from '@/utils/ingestion/billingAccumulator';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';
import { makeProcessedData } from '../helpers/testUtils';

const ctx = { pricing: PRICING };
const row = (partial: Partial<NormalizedRow> = {}) => makeNormalizedRow({
  user: 'test-user-one',
  model: 'test-model',
  sku: 'copilot_ai_credit',
  unitType: 'ai-credits',
  usageUnit: 'ai_credit',
  ...partial,
});

describe('BillingAggregator', () => {
  it('adapts processed rows with UTC day, AI-credit quantity, and net billing', () => {
    const processed = makeProcessedData({
      timestamp: new Date('2025-06-30T23:59:59Z'),
      creditsUsed: 7.5,
      quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
      grossAmount: .075,
      discountAmount: .025,
      netAmount: .05,
      organization: 'test-org-one',
      inputTokens: 100,
    });
    expect(buildNormalizedRowFromProcessedData(processed)).toMatchObject({
      date: processed.iso,
      day: '2025-06-30',
      quantity: 7.5,
      quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
      grossAmount: .075,
      netAmount: .05,
      organization: 'test-org-one',
      inputTokens: 100,
    });
  });

  it('sums supplied gross, discount, and net without deriving costs from quantity', () => {
    const agg = new BillingAggregator();
    agg.onRow(row({ quantity: 2.5, grossAmount: .025, discountAmount: .015, netAmount: .01 }), ctx);
    agg.onRow(row({ quantity: 3, grossAmount: .03, discountAmount: 0, netAmount: .03 }), ctx);
    const result = agg.finalize(ctx);
    expect(result.totals.gross).toBeCloseTo(.055);
    expect(result.totals.discount).toBeCloseTo(.015);
    expect(result.totals.net).toBeCloseTo(.04);
    expect(result.userMap.get('test-user-one')?.quantity).toBe(5.5);
    expect(result.userMap.get('test-user-one')?.net).toBeCloseTo(.04);
    expect(result.hasAnyBillingData).toBe(true);
  });

  it('keeps billing columns optional for older AI-credit datasets', () => {
    const result = buildBillingArtifactsFromProcessedData([
      makeProcessedData({ creditsUsed: 2, grossAmount: undefined, discountAmount: undefined, netAmount: undefined }),
    ]);
    expect(result.hasAnyBillingData).toBe(false);
    expect(result.totals).toMatchObject({ gross: 0, discount: 0, net: 0 });
    expect(result.userMap.get('test-user-one')?.quantity).toBe(2);
  });

  it('preserves primary billing quantity and supplemental AI-credit gross', () => {
    const agg = new BillingAggregator();
    agg.onRow(row({
      quantity: 42.726213,
      billingQuantity: 42.726213,
      aicQuantity: 42.726213,
      aicGrossAmount: .42726213,
      grossAmount: .42726213,
      discountAmount: .32726213,
      netAmount: .1,
    }), ctx);
    const result = agg.finalize(ctx);
    expect(result.totals.aicQuantity).toBeCloseTo(42.726213);
    expect(result.totals.aicGrossAmount).toBeCloseTo(.42726213);
    expect(result.totals.net).toBeCloseTo(.1);
    expect(result.userMap.get('test-user-one')?.quantity).toBeCloseTo(42.726213);
  });

  it('uses the highest recognized quota for a user with mixed tier rows', () => {
    const agg = new BillingAggregator();
    agg.onRow(row({ quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA }), ctx);
    agg.onRow(row({ quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA }), ctx);
    agg.onRow(row({ quotaValue: 'unknown' }), ctx);
    expect(agg.finalize(ctx).userMap.get('test-user-one')?.quotaValue)
      .toBe(PRICING.ENTERPRISE_AI_CREDIT_QUOTA);
  });

  it('groups organization, cost center, and model totals', () => {
    const agg = new BillingAggregator();
    agg.onRow(row({
      user: 'test-user-one',
      quantity: 2,
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one',
      netAmount: .02,
    }), ctx);
    agg.onRow(row({
      user: 'test-user-two',
      quantity: 3,
      organization: 'test-org-one',
      costCenter: 'test-cost-center-two',
      netAmount: .03,
    }), ctx);
    const result = agg.finalize(ctx);
    expect(result.orgTotals.get('test-org-one')?.quantity).toBe(5);
    expect(result.orgTotals.get('test-org-one')?.net).toBeCloseTo(.05);
    expect(result.costCenterTotals.get('test-cost-center-one')?.net).toBe(.02);
    expect(result.billingByModel.get('test-model')?.quantity).toBe(5);
  });

  it('retains unattributed AI credits outside named-user billing while including grouped totals', () => {
    const agg = new BillingAggregator();
    agg.onRow(row({
      user: '',
      model: 'Code Review',
      quantity: 12.5,
      grossAmount: .125,
      netAmount: 0,
      organization: 'test-org-one',
      isUnattributedUsage: true,
      usageBucket: 'unattributed_ai_credit',
    }), ctx);
    const result = agg.finalize(ctx);
    expect(result.users).toEqual([]);
    expect(result.specialBuckets).toEqual([
      expect.objectContaining({ key: 'unattributed_ai_credit', quantity: 12.5, gross: .125, net: 0 }),
    ]);
    expect(result.orgTotals.get('test-org-one')?.quantity).toBe(12.5);
  });
});
