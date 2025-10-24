import { FeatureUsageAggregator } from '@/utils/ingestion/FeatureUsageAggregator';
import { AggregatorContext, NormalizedRow } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';

function makeRow(partial: Partial<NormalizedRow>): NormalizedRow {
  return {
    date: partial.date || '2025-06-01T00:00:00Z',
    day: partial.day || '2025-06-01',
    user: partial.user || 'u',
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
      makeRow({ user: 'u1', model: 'Code Review', quantity: 3 }),
      makeRow({ user: 'u2', model: 'code review session', quantity: 2 }),
      makeRow({ user: 'u1', model: 'Coding Agent', quantity: 5 }),
      makeRow({ user: 'u3', model: 'Padawan', quantity: 4 }),
      makeRow({ user: 'u2', model: 'Spark', quantity: 7 }),
      makeRow({ user: 'u4', model: 'Spark Playground', quantity: 1 })
    ];
    for (const r of rows) agg.onRow(r, ctx);
    const out = agg.finalize(ctx);
    expect(out.featureTotals.codeReview).toBe(5);
    expect(out.featureTotals.codingAgent).toBe(9);
    expect(out.featureTotals.spark).toBe(8);
    expect(out.featureUsers.codeReview.size).toBe(2);
    expect(out.featureUsers.codingAgent.size).toBe(2);
    expect(out.featureUsers.spark.size).toBe(2);
    expect(out.featureUsers.codeReview.has('u1')).toBeTruthy();
    expect(out.featureUsers.codeReview.has('u2')).toBeTruthy();
  });
});
