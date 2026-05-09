import type { ProcessedData } from '@/types/csv';
import { buildBillingArtifactsFromProcessedData } from '@/utils/ingestion/billingAccumulator';
import { BillingAggregator } from '@/utils/ingestion/BillingAggregator';
import { AggregatorContext, NormalizedRow } from '@/utils/ingestion/types';
import { PRICING } from '@/constants/pricing';

describe('BillingAggregator', () => {
  const ctx: AggregatorContext = { pricing: PRICING };

  function buildRow(partial: Partial<NormalizedRow>): NormalizedRow {
    return {
      date: '2025-07-01T00:00:00Z',
      day: '2025-07-01',
      user: 'user1',
      model: 'gpt-test',
      quantity: 1,
      ...partial
    };
  }

  function buildProcessedRow(partial: Partial<ProcessedData>): ProcessedData {
    const timestamp = new Date('2025-07-01T00:00:00Z');

    return {
      timestamp,
      user: 'test-user-one',
      model: 'Code Review',
      requestsUsed: 1,
      exceedsQuota: false,
      totalQuota: '1000',
      quotaValue: PRICING.ENTERPRISE_QUOTA,
      iso: timestamp.toISOString(),
      dateKey: '2025-07-01',
      monthKey: '2025-07',
      epoch: timestamp.getTime(),
      ...partial,
    };
  }

  it('aggregates global billing totals', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({ user: 'a', grossAmount: 10, discountAmount: 2, netAmount: 8, quantity: 5 }), ctx);
    agg.onRow(buildRow({ user: 'b', grossAmount: 5, discountAmount: 1, netAmount: 4, quantity: 3 }), ctx);
    const out = agg.finalize(ctx);
    expect(out.totals.gross).toBeCloseTo(15);
    expect(out.totals.discount).toBeCloseTo(3);
    expect(out.totals.net).toBeCloseTo(12);
    expect(out.hasAnyBillingData).toBe(true);
    expect(out.hasAnyAicData).toBe(false);
  });

  it('tracks per-user totals and quantity', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({ user: 'a', grossAmount: 2, netAmount: 2, quantity: 2 }), ctx);
    agg.onRow(buildRow({ user: 'a', grossAmount: 3, netAmount: 3, quantity: 3 }), ctx);
    agg.onRow(buildRow({ user: 'b', grossAmount: 4, discountAmount: 1, netAmount: 3, quantity: 1 }), ctx);
    const out = agg.finalize(ctx);
    const a = out.userMap.get('a')!;
    const b = out.userMap.get('b')!;
    expect(a.gross).toBe(5);
    expect(a.net).toBe(5);
    expect(a.quantity).toBe(5);
    expect(b.gross).toBe(4);
    expect(b.discount).toBe(1);
    expect(b.net).toBe(3);
    expect(b.quantity).toBe(1);
  });

  it('tracks grouped billing totals for organizations, cost centers, and models', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({
      user: 'test-user-one',
      model: 'Claude Sonnet 4',
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one',
      grossAmount: 2,
      discountAmount: 0.5,
      netAmount: 1.5,
      aicQuantity: 10,
      aicGrossAmount: 0.1,
      quantity: 2,
    }), ctx);
    agg.onRow(buildRow({
      user: 'test-user-two',
      model: 'Claude Sonnet 4',
      organization: 'test-org-one',
      costCenter: 'test-cost-center-two',
      grossAmount: 3,
      discountAmount: 1,
      netAmount: 2,
      aicQuantity: 20,
      aicGrossAmount: 0.2,
      quantity: 3,
    }), ctx);

    const out = agg.finalize(ctx);
    const orgTotals = out.orgTotals.get('test-org-one');
    expect(orgTotals).toMatchObject({
      gross: 5,
      discount: 1.5,
      net: 3.5,
      aicQuantity: 30,
      quantity: 5,
    });
    expect(orgTotals?.aicGrossAmount).toBeCloseTo(0.3);
    expect(out.costCenterTotals.get('test-cost-center-one')?.net).toBe(1.5);
    expect(out.costCenterTotals.get('test-cost-center-two')?.net).toBe(2);
    expect(out.billingByModel.get('Claude Sonnet 4')?.quantity).toBe(5);
  });

  it('handles absence of billing fields gracefully', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({ user: 'a', quantity: 2 }), ctx);
    agg.onRow(buildRow({ user: 'b', quantity: 3 }), ctx);
    const out = agg.finalize(ctx);
    expect(out.hasAnyBillingData).toBe(false);
    expect(out.hasAnyAicData).toBe(false);
    expect(out.totals.gross).toBe(0);
    expect(out.totals.aicQuantity).toBe(0);
    expect(out.totals.aicGrossAmount).toBe(0);
    expect(out.totals.aicIncludedCredits).toBe(0);
    expect(out.totals.aicAdditionalUsageGrossAmount).toBe(0);
    expect(out.users.find(u => u.user === 'a')?.quantity).toBe(2);
  });

  it('aggregates AI Credits totals globally and per user', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({ user: 'a', quantity: 2, aicQuantity: 8.68986, aicGrossAmount: 0.0868986 }), ctx);
    agg.onRow(buildRow({ user: 'a', quantity: 1, aicQuantity: 1.31014, aicGrossAmount: 0.0131014 }), ctx);
    agg.onRow(buildRow({ user: 'b', quantity: 3, aicQuantity: 18.33306, aicGrossAmount: 0.1833306 }), ctx);

    const out = agg.finalize(ctx);
    expect(out.hasAnyAicData).toBe(true);
    expect(out.totals.aicQuantity).toBeCloseTo(28.33306);
    expect(out.totals.aicGrossAmount).toBeCloseTo(0.2833306);

    const a = out.userMap.get('a')!;
    expect(a.aicQuantity).toBeCloseTo(10);
    expect(a.aicGrossAmount).toBeCloseTo(0.1);
  });

  it('estimates included AI Credits and additional usage gross by user quota', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({ user: 'business-user', quantity: 1, quotaValue: PRICING.BUSINESS_QUOTA, aicQuantity: 4000, aicGrossAmount: 40 }), ctx);
    agg.onRow(buildRow({ user: 'business-user', quantity: 1, quotaValue: PRICING.BUSINESS_QUOTA, aicQuantity: 2000, aicGrossAmount: 20 }), ctx);
    agg.onRow(buildRow({ user: 'enterprise-user', quantity: 1, quotaValue: PRICING.ENTERPRISE_QUOTA, aicQuantity: 5000, aicGrossAmount: 50 }), ctx);

    const out = agg.finalize(ctx);

    expect(out.totals.aicIncludedCredits).toBe(10000);
    expect(out.totals.aicAdditionalUsageGrossAmount).toBeCloseTo(10);
  });

  it('does not estimate included AI Credits without AI Credits gross data', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({ user: 'business-user', quantity: 1, quotaValue: PRICING.BUSINESS_QUOTA }), ctx);
    agg.onRow(buildRow({ user: 'enterprise-user', quantity: 1, quotaValue: PRICING.ENTERPRISE_QUOTA, aicQuantity: 5000 }), ctx);

    const out = agg.finalize(ctx);

    expect(out.hasAnyAicData).toBe(false);
    expect(out.totals.aicQuantity).toBe(5000);
    expect(out.totals.aicGrossAmount).toBe(0);
    expect(out.totals.aicIncludedCredits).toBe(0);
    expect(out.totals.aicAdditionalUsageGrossAmount).toBe(0);
  });

  it('stores non-Copilot code review billing in a special bucket instead of a user entry', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({ user: '', model: 'Code Review', quantity: 2, grossAmount: 1, netAmount: 1, aicQuantity: 4, aicGrossAmount: 0.04, isNonCopilotUsage: true, usageBucket: 'non_copilot_code_review' }), ctx);

    const out = agg.finalize(ctx);
    expect(out.users).toEqual([]);
    expect(out.specialBuckets).toEqual([
      expect.objectContaining({
        key: 'non_copilot_code_review',
        quantity: 2,
        gross: 1,
        net: 1,
        aicQuantity: 4,
        aicGrossAmount: 0.04,
        quotaValue: 0
      })
    ]);
  });

  it('includes non-Copilot aggregate rows in grouped billing totals', () => {
    const agg = new BillingAggregator();
    agg.init?.(ctx);
    agg.onRow(buildRow({
      user: 'test-user-one',
      model: 'Code Review',
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one',
      quantity: 1,
      grossAmount: 2,
      netAmount: 2,
    }), ctx);
    agg.onRow(buildRow({
      user: '',
      model: 'Code Review',
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one',
      quantity: 2,
      grossAmount: 3,
      netAmount: 3,
      isNonCopilotUsage: true,
      usageBucket: 'non_copilot_code_review',
    }), ctx);

    const out = agg.finalize(ctx);
    expect(out.userMap.get('test-user-one')?.quantity).toBe(1);
    expect(out.users).toHaveLength(1);
    expect(out.specialBuckets?.[0]?.quantity).toBe(2);
    expect(out.orgTotals.get('test-org-one')?.quantity).toBe(3);
    expect(out.orgTotals.get('test-org-one')?.gross).toBe(5);
    expect(out.costCenterTotals.get('test-cost-center-one')?.net).toBe(5);
    expect(out.billingByModel.get('Code Review')?.quantity).toBe(3);
  });

  it('builds billing artifacts from filtered processed data', () => {
    const out = buildBillingArtifactsFromProcessedData([
      buildProcessedRow({
        user: 'test-user-one',
        organization: 'test-org-one',
        costCenter: 'test-cost-center-one',
        requestsUsed: 4,
        grossAmount: 8,
        netAmount: 8,
      }),
      buildProcessedRow({
        user: '',
        organization: 'test-org-one',
        costCenter: 'test-cost-center-one',
        requestsUsed: 2,
        grossAmount: 3,
        netAmount: 3,
        isNonCopilotUsage: true,
        usageBucket: 'non_copilot_code_review',
      }),
    ]);

    expect(out.userMap.get('test-user-one')?.quantity).toBe(4);
    expect(out.specialBuckets).toEqual([
      expect.objectContaining({
        key: 'non_copilot_code_review',
        quantity: 2,
        gross: 3,
        net: 3,
      }),
    ]);
    expect(out.orgTotals.get('test-org-one')?.quantity).toBe(6);
    expect(out.costCenterTotals.get('test-cost-center-one')?.quantity).toBe(6);
    expect(out.billingByModel.get('Code Review')?.quantity).toBe(6);
  });
});
