import { aggregateDailyConsumption } from '@/utils/dailyConsumption';

import { makeProcessedData } from '../helpers/testUtils';

describe('aggregateDailyConsumption', () => {
  it('sums reported USD amounts across users, products, and unattributed usage in UTC day order', () => {
    const rows = [
      makeProcessedData({
        timestamp: new Date('2026-07-01T00:00:00Z'),
        discountAmount: 0,
        netAmount: 2.3456,
      }),
      makeProcessedData({
        timestamp: new Date('2026-06-30T23:59:59Z'),
        discountAmount: 1.2345,
        netAmount: 0.5,
        creditsUsed: 999,
        aicGrossAmount: 999,
      }),
      makeProcessedData({
        timestamp: new Date('2026-06-30T12:00:00Z'),
        user: 'test-user-two',
        product: 'spark',
        discountAmount: 2,
        netAmount: 1,
      }),
      makeProcessedData({
        timestamp: new Date('2026-06-30T00:00:00Z'),
        user: '',
        model: 'Code Review',
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
        discountAmount: 3,
        netAmount: 2,
      }),
    ];

    const result = aggregateDailyConsumption(rows);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-06-30');
    expect(result[0].included).toBeCloseTo(6.2345);
    expect(result[0].additional).toBe(3.5);
    expect(result[1]).toEqual({ date: '2026-07-01', included: 0, additional: 2.3456 });
  });

  it('retains reported zeros and optional monetary fields without inferring costs', () => {
    expect(aggregateDailyConsumption([
      makeProcessedData({ discountAmount: 0, netAmount: 0 }),
      makeProcessedData({ discountAmount: 1 }),
      makeProcessedData({ netAmount: 2 }),
      makeProcessedData({
        timestamp: new Date('2026-08-01T00:00:00Z'),
        grossAmount: 100,
        creditsUsed: 100,
        inputTokens: 100,
      }),
    ])).toEqual([{ date: '2025-06-01', included: 1, additional: 2 }]);
  });

  it('omits rows without daily monetary amounts', () => {
    expect(aggregateDailyConsumption([])).toEqual([]);
    expect(aggregateDailyConsumption([makeProcessedData({ inputTokens: 100 })])).toEqual([]);
  });
});
