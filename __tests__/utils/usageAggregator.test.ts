import { PRICING } from '@/constants/pricing';
import {
  AggregatorContext,
  DailyBucketsAggregator,
  NormalizedRow,
  QuotaAggregator,
  UsageAggregator,
  buildDailyBucketsArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  buildUsageArtifactsFromProcessedData,
} from '@/utils/ingestion';
import type { ProcessedData } from '@/types/csv';

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

describe('UsageAggregator', () => {
  test('retains per-user organization and cost center metadata and collects distinct values', () => {
    const agg = new UsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);

    const rows: NormalizedRow[] = [
      makeRow({ user: 'test-user-one', organization: 'test-org-two', costCenter: 'test-cost-center-one', quantity: 2 }),
      makeRow({ user: 'test-user-one', model: 'gpt-4.1', quantity: 3 }),
      makeRow({ user: 'test-user-two', organization: 'test-org-one', costCenter: 'test-cost-center-two', quantity: 1 }),
      makeRow({ user: 'test-user-three', costCenter: 'test-cost-center-two', quantity: 4 }),
    ];

    for (const row of rows) {
      agg.onRow(row, ctx);
    }

    const output = agg.finalize(ctx);

    expect(output.organizations).toEqual(['test-org-one', 'test-org-two']);
    expect(output.costCenters).toEqual(['test-cost-center-one', 'test-cost-center-two']);
    expect(output.users).toEqual(expect.arrayContaining([
      expect.objectContaining({ user: 'test-user-one', organization: 'test-org-two', costCenter: 'test-cost-center-one', totalRequests: 5 }),
      expect.objectContaining({ user: 'test-user-two', organization: 'test-org-one', costCenter: 'test-cost-center-two', totalRequests: 1 }),
      expect.objectContaining({ user: 'test-user-three', organization: undefined, costCenter: 'test-cost-center-two', totalRequests: 4 }),
    ]));
  });

  test('keeps blank-username code review rows out of user aggregates and emits a special bucket', () => {
    const agg = new UsageAggregator();
    const ctx: AggregatorContext = { pricing: PRICING };
    agg.init?.(ctx);

    agg.onRow({
      ...makeRow({ user: '', model: 'Code Review', quantity: 6 }),
      isNonCopilotUsage: true,
      usageBucket: 'non_copilot_code_review'
    }, ctx);
    agg.onRow(makeRow({ user: 'test-user-one', model: 'gpt-4.1', quantity: 2 }), ctx);

    const output = agg.finalize(ctx);

    expect(output.users).toHaveLength(1);
    expect(output.users[0].user).toBe('test-user-one');
    expect(output.specialBuckets).toEqual([
      expect.objectContaining({
        key: 'non_copilot_code_review',
        totalRequests: 6,
        quotaValue: 0,
        modelBreakdown: { 'Code Review': 6 }
      })
    ]);
  });

  test('processed data builder matches UsageAggregator output and includes top model metadata', () => {
    const ctx: AggregatorContext = { pricing: PRICING };
    const rows: NormalizedRow[] = [
      makeRow({
        user: 'test-user-one',
        model: 'model-one',
        quantity: 2,
        organization: 'test-org-one',
        costCenter: 'test-cost-center-one',
      }),
      makeRow({
        user: 'test-user-one',
        model: 'model-two',
        quantity: 5,
      }),
      makeRow({
        user: 'test-user-two',
        model: 'model-one',
        quantity: 3,
        organization: 'test-org-two',
        costCenter: 'test-cost-center-two',
      }),
      {
        ...makeRow({ user: '', model: 'Code Review', quantity: 4 }),
        isNonCopilotUsage: true,
        usageBucket: 'non_copilot_code_review',
      },
    ];
    const agg = new UsageAggregator();
    agg.init?.(ctx);
    for (const row of rows) {
      agg.onRow(row, ctx);
    }

    const processedRows: ProcessedData[] = rows.map((row) => ({
      timestamp: new Date(`${row.day}T00:00:00Z`),
      user: row.user,
      model: row.model,
      requestsUsed: row.quantity,
      exceedsQuota: row.exceedsQuota ?? false,
      totalQuota: row.quotaRaw ?? 'Unlimited',
      quotaValue: row.quotaValue ?? 'unlimited',
      iso: `${row.day}T00:00:00.000Z`,
      dateKey: row.day,
      monthKey: row.day.slice(0, 7),
      epoch: new Date(`${row.day}T00:00:00Z`).getTime(),
      organization: row.organization,
      costCenter: row.costCenter,
      isNonCopilotUsage: row.isNonCopilotUsage,
      usageBucket: row.usageBucket,
    }));

    const streamingOutput = agg.finalize(ctx);
    const processedOutput = buildUsageArtifactsFromProcessedData(processedRows);

    expect(processedOutput).toEqual(streamingOutput);
    expect(processedOutput.users).toEqual(expect.arrayContaining([
      expect.objectContaining({
        user: 'test-user-one',
        topModel: 'model-two',
        topModelValue: 5,
      }),
    ]));
    expect(processedOutput.specialBuckets).toEqual([
      expect.objectContaining({
        key: 'non_copilot_code_review',
        totalRequests: 4,
        modelBreakdown: { 'Code Review': 4 },
      }),
    ]);
  });
});

describe('processed data artifact builders', () => {
  function toProcessedData(rows: NormalizedRow[]): ProcessedData[] {
    return rows.map((row) => ({
      timestamp: new Date(`${row.day}T00:00:00Z`),
      user: row.user,
      model: row.model,
      requestsUsed: row.quantity,
      exceedsQuota: row.exceedsQuota ?? false,
      totalQuota: row.quotaRaw ?? (row.quotaValue === 'unlimited' ? 'Unlimited' : String(row.quotaValue ?? 'Unlimited')),
      quotaValue: row.quotaValue ?? 'unlimited',
      iso: `${row.day}T00:00:00.000Z`,
      dateKey: row.day,
      monthKey: row.day.slice(0, 7),
      epoch: new Date(`${row.day}T00:00:00Z`).getTime(),
      product: row.product,
      sku: row.sku,
      organization: row.organization,
      costCenter: row.costCenter,
      appliedCostPerQuantity: row.appliedCostPerQuantity,
      grossAmount: row.grossAmount,
      discountAmount: row.discountAmount,
      netAmount: row.netAmount,
      isNonCopilotUsage: row.isNonCopilotUsage,
      usageBucket: row.usageBucket,
    }));
  }

  test('quota processed-data builder matches QuotaAggregator license semantics', () => {
    const ctx: AggregatorContext = { pricing: PRICING };
    const rows: NormalizedRow[] = [
      makeRow({ user: 'test-user-one', quotaValue: PRICING.BUSINESS_QUOTA, quotaRaw: String(PRICING.BUSINESS_QUOTA) }),
      makeRow({ user: 'test-user-two', quotaValue: 'unlimited', quotaRaw: 'Unlimited' }),
      {
        ...makeRow({ user: '', model: 'Code Review', quantity: 4, quotaValue: PRICING.BUSINESS_QUOTA }),
        isNonCopilotUsage: true,
        usageBucket: 'non_copilot_code_review',
      },
    ];
    const aggregator = new QuotaAggregator();
    aggregator.init?.(ctx);
    for (const row of rows) {
      aggregator.onRow(row, ctx);
    }

    const output = buildQuotaArtifactsFromProcessedData(toProcessedData(rows));

    expect(output).toEqual(aggregator.finalize(ctx));
    expect(output.hasMixedQuotas).toBe(true);
    expect(output.hasMixedLicenses).toBe(false);
    expect(output.specialBucketQuotas?.get('non_copilot_code_review')).toBe(0);
  });

  test('daily processed-data builder includes per-model and special bucket breakdowns', () => {
    const ctx: AggregatorContext = { pricing: PRICING };
    const rows: NormalizedRow[] = [
      makeRow({ user: 'test-user-one', model: 'model-one', quantity: 2 }),
      makeRow({ user: 'test-user-one', model: 'model-two', quantity: 3 }),
      makeRow({ user: 'test-user-two', model: 'model-one', quantity: 5, day: '2025-06-02', date: '2025-06-02T00:00:00Z' }),
      {
        ...makeRow({ user: '', model: 'Code Review', quantity: 7, day: '2025-06-02', date: '2025-06-02T00:00:00Z' }),
        isNonCopilotUsage: true,
        usageBucket: 'non_copilot_code_review',
      },
    ];
    const aggregator = new DailyBucketsAggregator();
    aggregator.init?.(ctx);
    for (const row of rows) {
      aggregator.onRow(row, ctx);
    }

    const output = buildDailyBucketsArtifactsFromProcessedData(toProcessedData(rows));

    expect(output).toEqual(aggregator.finalize(ctx));
    expect(output.dailyUserModelTotals?.get('2025-06-01')?.get('test-user-one')?.get('model-two')).toBe(3);
    expect(output.dailyBucketTotals?.get('2025-06-02')?.get('non_copilot_code_review')).toBe(7);
    expect(output.dailyBucketModelTotals?.get('2025-06-02')?.get('non_copilot_code_review')?.get('Code Review')).toBe(7);
  });
});
