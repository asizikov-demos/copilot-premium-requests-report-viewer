import type { ProcessedData } from '@/types/csv';
import { aggregateProductCosts } from '@/utils/productCosts';

function createRow(overrides: Partial<ProcessedData>): ProcessedData {
  const timestamp = new Date('2025-10-01T00:00:00Z');

  return {
    timestamp,
    user: 'user-1',
    model: 'Claude Sonnet 4',
    requestsUsed: 1,
    exceedsQuota: false,
    totalQuota: '1000',
    quotaValue: 1000,
    iso: timestamp.toISOString(),
    dateKey: '2025-10-01',
    monthKey: '2025-10',
    epoch: timestamp.getTime(),
    grossAmount: 0.04,
    discountAmount: 0,
    netAmount: 0.04,
    ...overrides,
  };
}

describe('aggregateProductCosts', () => {
  test('aggregates rows in stable product order with display labels', () => {
    const rows: ProcessedData[] = [
      createRow({ product: 'copilot', sku: 'copilot_premium_request', model: 'Claude Sonnet 4', requestsUsed: 2, grossAmount: 0.08, netAmount: 0.08 }),
      createRow({ product: 'spark', sku: 'spark_premium_request', model: 'Claude Sonnet 4.5', requestsUsed: 3, grossAmount: 0.12, netAmount: 0.12 }),
      createRow({ model: 'Coding Agent model', requestsUsed: 4, grossAmount: 0.16, netAmount: 0.16 }),
      createRow({ model: 'Code Review model', requestsUsed: 5, grossAmount: 0.2, netAmount: 0.2 }),
    ];

    expect(aggregateProductCosts(rows)).toEqual([
      expect.objectContaining({ category: 'Copilot', label: 'Copilot', requests: 2 }),
      expect.objectContaining({ category: 'Spark', label: 'Spark', requests: 3 }),
      expect.objectContaining({ category: 'Coding Agent', label: 'Cloud Agent', requests: 4 }),
      expect.objectContaining({ category: 'Code Review', label: 'Code Review', requests: 5 }),
    ]);
  });
});