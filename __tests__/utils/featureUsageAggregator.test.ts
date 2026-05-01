import { FeatureUsageAggregator } from '@/utils/ingestion/FeatureUsageAggregator';
import { AggregatorContext, NormalizedRow } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';

function makeRow(partial: Partial<NormalizedRow>): NormalizedRow {
  return {
    date: partial.date || '2025-06-01T00:00:00Z',
    day: partial.day || '2025-06-01',
    user: partial.user || 'test-user-one',
    model: partial.model || 'o3-mini',
    quantity: partial.quantity ?? 1,
    quotaRaw: partial.quotaRaw,
    quotaValue: partial.quotaValue,
    exceedsQuota: partial.exceedsQuota,
    product: partial.product,
    sku: partial.sku,
    organization: partial.organization,
    costCenter: partial.costCenter,
    appliedCostPerQuantity: partial.appliedCostPerQuantity,
    grossAmount: partial.grossAmount,
    discountAmount: partial.discountAmount,
    netAmount: partial.netAmount
  };
}

describe('FeatureUsageAggregator', () => {
  test('aggregates totals and user sets per feature', () => {
    const agg = new FeatureUsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);
    const rows: NormalizedRow[] = [
      makeRow({ user: 'test-user-one', model: 'Code Review', quantity: 3 }),
      makeRow({ user: 'test-user-two', model: 'code review session', quantity: 2 }),
      makeRow({ user: 'test-user-one', model: 'Coding Agent', quantity: 5 }),
      makeRow({ user: 'test-user-three', model: 'Padawan', quantity: 4 }),
      makeRow({ user: 'test-user-two', model: 'gpt-4.1', product: 'spark', sku: 'spark_premium_request', quantity: 7 }),
      makeRow({ user: 'test-user-four', model: 'o3-mini', product: 'spark', sku: 'spark_premium_request', quantity: 1 })
    ];
    for (const r of rows) agg.onRow(r, ctx);
    const out = agg.finalize(ctx);
    expect(out.featureTotals.codeReview).toBe(5);
    expect(out.featureTotals.codingAgent).toBe(9);
    expect(out.featureTotals.spark).toBe(8);
    expect(out.featureUsers.codeReview.size).toBe(2);
    expect(out.featureUsers.codingAgent.size).toBe(2);
    expect(out.featureUsers.spark.size).toBe(2);
    expect(out.featureUsers.codeReview.has('test-user-one')).toBeTruthy();
    expect(out.featureUsers.codeReview.has('test-user-two')).toBeTruthy();
  });

  test('counts non-Copilot code review usage in totals but not in user counts', () => {
    const agg = new FeatureUsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);

    agg.onRow({
      ...makeRow({ user: 'test-user-empty', model: 'Code Review', quantity: 4 }),
      isNonCopilotUsage: true,
      usageBucket: 'non_copilot_code_review'
    }, ctx);
    agg.onRow(makeRow({ user: 'test-user-one', model: 'Code Review', quantity: 1 }), ctx);

    const out = agg.finalize(ctx);
    expect(out.featureTotals.codeReview).toBe(5);
    expect(out.featureUsers.codeReview.size).toBe(1);
    expect(out.featureUsers.codeReview.has('test-user-one')).toBe(true);
    expect(out.specialTotals.nonCopilotCodeReview).toBe(4);
  });
});
