import { PRICING } from '@/constants/pricing';
import { AggregatorContext, NormalizedRow } from '@/utils/ingestion';
import { FeatureUsageAggregator } from '@/utils/ingestion/FeatureUsageAggregator';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

describe('FeatureUsageAggregator', () => {
  test('aggregates totals and user sets per feature', () => {
    const agg = new FeatureUsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);
    const rows: NormalizedRow[] = [
      makeNormalizedRow({ user: 'u1', model: 'Code Review', quantity: 3 }),
      makeNormalizedRow({ user: 'u2', model: 'code review session', quantity: 2 }),
      makeNormalizedRow({ user: 'u1', model: 'Coding Agent', quantity: 5 }),
      makeNormalizedRow({ user: 'u3', model: 'Copilot Coding Agent', quantity: 4 }),
      makeNormalizedRow({ user: 'u2', model: 'gpt-4.1', product: 'spark', sku: 'spark_premium_request', quantity: 7 }),
      makeNormalizedRow({ user: 'u4', model: 'o3-mini', product: 'spark', sku: 'spark_premium_request', quantity: 1 })
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

  test('counts non-Copilot code review usage in totals but not in user counts', () => {
    const agg = new FeatureUsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);

    agg.onRow(makeNormalizedRow({
      user: '',
      model: 'Code Review',
      quantity: 4,
      isNonCopilotUsage: true,
      usageBucket: 'non_copilot_code_review'
    }), ctx);
    agg.onRow(makeNormalizedRow({ user: 'u1', model: 'Code Review', quantity: 1 }), ctx);

    const out = agg.finalize(ctx);
    expect(out.featureTotals.codeReview).toBe(5);
    expect(out.featureUsers.codeReview.size).toBe(1);
    expect(out.featureUsers.codeReview.has('u1')).toBe(true);
    expect(out.specialTotals.nonCopilotCodeReview).toBe(4);
  });
});
