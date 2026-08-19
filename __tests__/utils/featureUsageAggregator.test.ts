import { PRICING } from '@/constants/pricing';
import { AggregatorContext, NormalizedRow, normalizeRow } from '@/utils/ingestion';
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
      makeNormalizedRow({ user: 'u4', model: 'o3-mini', product: 'spark', sku: 'spark_premium_request', quantity: 1 }),
      makeNormalizedRow({ user: 'u5', model: 'Claude Sonnet 4.6', product: 'code_quality', sku: 'code_quality_ai_credit', quantity: 0, billingQuantity: 51.28584 }),
      makeNormalizedRow({ user: '', model: 'Claude Sonnet 4.6', product: 'code_quality', sku: 'code_quality_ai_credit', quantity: 0, billingQuantity: 10 })
    ];
    for (const r of rows) agg.onRow(r, ctx);
    const out = agg.finalize(ctx);
    expect(out.featureTotals.codeReview).toBe(5);
    expect(out.featureTotals.codingAgent).toBe(9);
    expect(out.featureTotals.spark).toBe(8);
    expect(out.featureTotals.codeQuality).toBe(61.28584);
    expect(out.featureUsers.codeReview.size).toBe(2);
    expect(out.featureUsers.codingAgent.size).toBe(2);
    expect(out.featureUsers.spark.size).toBe(2);
    expect(out.featureUsers.codeQuality.size).toBe(1);
    expect(out.featureUsers.codeQuality.has('u5')).toBeTruthy();
    expect(out.specialTotals.unattributedCodeQuality).toBe(10);
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

  test('counts Code Quality AI-credit rows from billing quantity after normalization', () => {
    const warnings: string[] = [];
    const row = normalizeRow({
      date: '2026-08-03',
      username: 'test-user-one',
      product: 'code_quality',
      sku: 'code_quality_ai_credit',
      model: 'Claude Sonnet 4.6',
      quantity: '51.28584',
      unit_type: 'ai-credits',
      applied_cost_per_quantity: '0.01',
      gross_amount: '0.5128584',
      discount_amount: '0',
      net_amount: '0.5128584',
      organization: 'test-org-one',
      cost_center_name: 'test-cost-center-one',
    }, warnings);

    expect(row).not.toBeNull();
    expect(row?.quantity).toBe(0);
    expect(row?.billingQuantity).toBe(51.28584);

    const agg = new FeatureUsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);
    agg.onRow(row as NormalizedRow, ctx);

    const out = agg.finalize(ctx);
    expect(out.featureTotals.codeQuality).toBe(51.28584);
    expect(out.featureUsers.codeQuality.size).toBe(1);
    expect(out.featureUsers.codeQuality.has('test-user-one')).toBe(true);
    expect(warnings).toEqual([]);
  });

  test('keeps blank-user Code Quality rows when unit_type is omitted', () => {
    const warnings: string[] = [];
    const row = normalizeRow({
      date: '2026-08-03',
      username: '',
      product: 'code_quality',
      sku: 'code_quality_ai_credit',
      model: 'Claude Sonnet 4.6',
      quantity: '51.28584',
      applied_cost_per_quantity: '0.01',
      gross_amount: '0.5128584',
      discount_amount: '0',
      net_amount: '0.5128584',
      organization: 'test-org-one',
      cost_center_name: 'test-cost-center-one',
    }, warnings);

    expect(row).not.toBeNull();
    expect(row?.usageUnit).toBe('ai_credit');
    expect(row?.quantity).toBe(0);
    expect(row?.billingQuantity).toBe(51.28584);
    expect(warnings).toEqual([]);

    const agg = new FeatureUsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);
    agg.onRow(row as NormalizedRow, ctx);

    const out = agg.finalize(ctx);
    expect(out.featureTotals.codeQuality).toBe(51.28584);
    expect(out.featureUsers.codeQuality.size).toBe(0);
    expect(out.specialTotals.unattributedCodeQuality).toBe(51.28584);
  });
});
