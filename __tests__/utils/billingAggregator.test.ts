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
    expect(out.totals.gross).toBe(0);
    expect(out.users.find(u => u.user === 'a')?.quantity).toBe(2);
  });
});
