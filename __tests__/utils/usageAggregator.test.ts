import { PRICING } from '@/constants/pricing';
import {
  AggregatorContext,
  DailyBucketsAggregator,
  NormalizedRow,
  UsageAggregator,
} from '@/utils/ingestion';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';
import { buildDailyBucketsArtifactsFromRows, buildQuotaArtifactsFromRows, buildUsageArtifactsFromRows } from '../helpers/normalizedArtifacts';

describe('UsageAggregator', () => {
  test('retains per-user organization and cost center metadata and collects distinct values', () => {
    const agg = new UsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);

    const rows: NormalizedRow[] = [
      makeNormalizedRow({ user: 'test-user-one', organization: 'test-org-two', costCenter: 'test-cost-center-one', quantity: 2 }),
      makeNormalizedRow({ user: 'test-user-one', model: 'gpt-4.1', costCenter: 'test-cost-center-two', quantity: 3 }),
      makeNormalizedRow({ user: 'test-user-two', organization: 'test-org-one', costCenter: 'test-cost-center-two', quantity: 1 }),
      makeNormalizedRow({ user: 'test-user-three', costCenter: 'test-cost-center-two', quantity: 4 }),
    ];

    for (const row of rows) {
      agg.onRow(row, ctx);
    }

    const output = agg.finalize(ctx);

    expect(output.organizations).toEqual(['test-org-one', 'test-org-two']);
    expect(output.costCenters).toEqual(['test-cost-center-one', 'test-cost-center-two']);
    expect(output.users).toEqual(expect.arrayContaining([
      expect.objectContaining({
        user: 'test-user-one',
        organization: 'test-org-two',
        costCenter: 'test-cost-center-one',
        costCenters: ['test-cost-center-one', 'test-cost-center-two'],
        totalCredits: 5,
      }),
      expect.objectContaining({ user: 'test-user-two', organization: 'test-org-one', costCenter: 'test-cost-center-two', totalCredits: 1 }),
      expect.objectContaining({ user: 'test-user-three', organization: undefined, costCenter: 'test-cost-center-two', totalCredits: 4 }),
    ]));
  });

  test('keeps blank-username code review rows out of user aggregates and emits a special bucket', () => {
    const agg = new UsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);

    agg.onRow(makeNormalizedRow({
      user: '',
      model: 'Code Review',
      quantity: 6,
      isUnattributedUsage: true,
      usageBucket: 'unattributed_ai_credit'
    }), ctx);
    agg.onRow(makeNormalizedRow({ user: 'test-user-one', model: 'gpt-4.1', quantity: 2 }), ctx);

    const output = agg.finalize(ctx);

    expect(output.users).toHaveLength(1);
    expect(output.users[0].user).toBe('test-user-one');
    expect(output.specialBuckets).toEqual([
      expect.objectContaining({
        key: 'unattributed_ai_credit',
        totalCredits: 6,
        quotaValue: 0,
        modelBreakdown: { 'Code Review': 6 }
      })
    ]);
  });

  test('includes top model metadata and unattributed usage totals', () => {
    const rows: NormalizedRow[] = [
      makeNormalizedRow({
        user: 'test-user-one',
        model: 'model-one',
        quantity: 2,
        organization: 'test-org-one',
        costCenter: 'test-cost-center-one',
      }),
      makeNormalizedRow({
        user: 'test-user-one',
        model: 'model-two',
        quantity: 5,
      }),
      makeNormalizedRow({
        user: 'test-user-two',
        model: 'model-one',
        quantity: 3,
        organization: 'test-org-two',
        costCenter: 'test-cost-center-two',
      }),
      makeNormalizedRow({
        user: '',
        model: 'Code Review',
        quantity: 4,
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
      }),
    ];
    const output = buildUsageArtifactsFromRows(rows);
    expect(output.users).toEqual(expect.arrayContaining([
      expect.objectContaining({
        user: 'test-user-one',
        topModel: 'model-two',
        topModelValue: 5,
      }),
    ]));
    expect(output.specialBuckets).toEqual([
      expect.objectContaining({
        key: 'unattributed_ai_credit',
        totalCredits: 4,
        modelBreakdown: { 'Code Review': 4 },
      }),
    ]);
  });
});

describe('normalized row aggregation', () => {
  test('preserves unattributed AI Credits', () => {
    const rows = [
      makeNormalizedRow({
        user: '',
        model: 'test-model-one',
        quantity: 18.5,
        billingQuantity: 18.5,
        usageUnit: 'ai_credit',
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
      }),
    ];

    const output = buildUsageArtifactsFromRows(rows);

    expect(output.users).toHaveLength(0);
    expect(output.specialBuckets).toEqual([
      expect.objectContaining({
        key: 'unattributed_ai_credit',
        totalCredits: 18.5,
        modelBreakdown: { 'test-model-one': 18.5 },
      }),
    ]);
  });

  test('keeps unattributed usage out of quota license classification', () => {
    const rows: NormalizedRow[] = [
      makeNormalizedRow({ user: 'test-user-one', unitType: 'ai-credits', quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA, quotaRaw: String(PRICING.BUSINESS_AI_CREDIT_QUOTA) }),
      makeNormalizedRow({ user: 'test-user-two', unitType: 'ai-credits', quotaValue: 'unknown', quotaRaw: 'Unknown' }),
      makeNormalizedRow({
        user: '',
        model: 'Code Review',
        quantity: 4,
        quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
      }),
    ];
    const output = buildQuotaArtifactsFromRows(rows);

    expect(output.quotaByUser).toEqual(new Map<string, number | 'unknown'>([
      ['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA],
      ['test-user-two', 'unknown'],
    ]));
    expect(output.hasMixedQuotas).toBe(true);
    expect(output.hasMixedLicenses).toBe(false);
    expect(output.specialBucketQuotas?.get('unattributed_ai_credit')).toBe(0);
  });

  test('includes daily per-model and special bucket breakdowns', () => {
    const rows: NormalizedRow[] = [
      makeNormalizedRow({ user: 'test-user-one', model: 'model-one', quantity: 2 }),
      makeNormalizedRow({ user: 'test-user-one', model: 'model-two', quantity: 3 }),
      makeNormalizedRow({ user: 'test-user-two', model: 'model-one', quantity: 5, day: '2025-06-02', date: '2025-06-02T00:00:00Z' }),
      makeNormalizedRow({
        user: '',
        model: 'Code Review',
        quantity: 7,
        day: '2025-06-02',
        date: '2025-06-02T00:00:00Z',
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
      }),
    ];
    const output = buildDailyBucketsArtifactsFromRows(rows);

    expect(output.dailyUserModelTotals?.get('2025-06-01')?.get('test-user-one')?.get('model-two')).toBe(3);
    expect(output.dailyBucketTotals?.get('2025-06-02')?.get('unattributed_ai_credit')).toBe(7);
    expect(output.dailyBucketModelTotals?.get('2025-06-02')?.get('unattributed_ai_credit')?.get('Code Review')).toBe(7);
  });

  test('daily aggregator accumulates repeated rows across user, AIC, and bucket maps', () => {
    const ctx: AggregatorContext = { pricing: PRICING };
    const rows: NormalizedRow[] = [
      makeNormalizedRow({ user: 'test-user-one', model: 'model-one', quantity: 2 }),
      makeNormalizedRow({ user: 'test-user-one', model: 'model-one', quantity: 3 }),
      makeNormalizedRow({ user: 'test-user-two', model: 'model-two', quantity: 4, usageUnit: 'ai_credit', aicQuantity: 4 }),
      makeNormalizedRow({ user: 'test-user-two', model: 'model-two', quantity: 6, usageUnit: 'ai_credit', aicQuantity: 6 }),
      makeNormalizedRow({
        user: '',
        model: 'Code Review',
        quantity: 7,
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
      }),
      makeNormalizedRow({
        user: '',
        model: 'Code Review',
        quantity: 11,
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
      }),
    ];
    const aggregator = new DailyBucketsAggregator();
    aggregator.init?.(ctx);
    for (const row of rows) {
      aggregator.onRow(row, ctx);
    }

    const output = aggregator.finalize(ctx);

    expect(output.dailyUserTotals.get('2025-06-01')?.get('test-user-one')).toBe(5);
    expect(output.dailyUserModelTotals?.get('2025-06-01')?.get('test-user-one')?.get('model-one')).toBe(5);
    expect(output.dailyUserTotals.get('2025-06-01')?.get('test-user-two')).toBe(10);
    expect(output.dailyUserModelTotals?.get('2025-06-01')?.get('test-user-two')?.get('model-two')).toBe(10);
    expect(output.dailyBucketTotals?.get('2025-06-01')?.get('unattributed_ai_credit')).toBe(18);
    expect(output.dailyBucketModelTotals?.get('2025-06-01')?.get('unattributed_ai_credit')?.get('Code Review')).toBe(18);
  });
});
