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
});
