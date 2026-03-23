import { PRICING } from '@/constants/pricing';
import { AggregatorContext, NormalizedRow, UsageAggregator } from '@/utils/ingestion';

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
      makeRow({ user: 'alice', organization: 'Org B', costCenter: 'Platform', quantity: 2 }),
      makeRow({ user: 'alice', model: 'gpt-4.1', quantity: 3 }),
      makeRow({ user: 'bob', organization: 'Org A', costCenter: 'Security', quantity: 1 }),
      makeRow({ user: 'carol', costCenter: 'Security', quantity: 4 }),
    ];

    for (const row of rows) {
      agg.onRow(row, ctx);
    }

    const output = agg.finalize(ctx);

    expect(output.organizations).toEqual(['Org A', 'Org B']);
    expect(output.costCenters).toEqual(['Platform', 'Security']);
    expect(output.users).toEqual(expect.arrayContaining([
      expect.objectContaining({ user: 'alice', organization: 'Org B', costCenter: 'Platform', totalRequests: 5 }),
      expect.objectContaining({ user: 'bob', organization: 'Org A', costCenter: 'Security', totalRequests: 1 }),
      expect.objectContaining({ user: 'carol', organization: undefined, costCenter: 'Security', totalRequests: 4 }),
    ]));
  });
});
