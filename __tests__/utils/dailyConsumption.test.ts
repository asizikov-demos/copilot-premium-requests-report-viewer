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
    expect(result).toHaveLength(61);
    expect(result[0]).toEqual({ date: '2026-06-01', included: 0, additional: 0 });
    expect(result[29].date).toBe('2026-06-30');
    expect(result[29].included).toBeCloseTo(6.2345);
    expect(result[29].additional).toBe(3.5);
    expect(result[30]).toEqual({ date: '2026-07-01', included: 0, additional: 2.3456 });
    expect(result[60]).toEqual({ date: '2026-07-31', included: 0, additional: 0 });
  });

  it('retains reported zeros and optional monetary fields without inferring costs', () => {
    const result = aggregateDailyConsumption([
      makeProcessedData({ discountAmount: 0, netAmount: 0 }),
      makeProcessedData({ discountAmount: 1 }),
      makeProcessedData({ netAmount: 2 }),
      makeProcessedData({
        timestamp: new Date('2025-06-02T00:00:00Z'),
        grossAmount: 100,
        creditsUsed: 100,
        inputTokens: 100,
      }),
    ]);
    expect(result).toHaveLength(30);
    expect(result[0]).toEqual({ date: '2025-06-01', included: 1, additional: 2 });
    expect(result[result.length - 1]).toEqual({ date: '2025-06-30', included: 0, additional: 0 });
    expect(result.slice(1).every(day => day.included === 0 && day.additional === 0)).toBe(true);
  });

  it.each([
    { month: '2024-02', days: 29 },
    { month: '2025-02', days: 28 },
    { month: '2025-12', days: 31 },
  ])('fills the complete UTC billing month $month', ({ month, days }) => {
    const result = aggregateDailyConsumption([
      makeProcessedData({ timestamp: new Date(`${month}-15T23:59:59Z`), netAmount: 1 }),
    ]);
    expect(result).toHaveLength(days);
    expect(result[0]).toEqual({ date: `${month}-01`, included: 0, additional: 0 });
    expect(result[14]).toEqual({ date: `${month}-15`, included: 0, additional: 1 });
    expect(result[days - 1]).toEqual({ date: `${month}-${days}`, included: 0, additional: 0 });
  });

  it('uses the report period even when the user has no usage in its boundary months', () => {
    const userRows = [
      makeProcessedData({ timestamp: new Date('2025-12-15T00:00:00Z'), netAmount: 1 }),
    ];
    const result = aggregateDailyConsumption(userRows, [
      ...userRows,
      makeProcessedData({ timestamp: new Date('2025-11-20T00:00:00Z'), user: 'test-user-two' }),
      makeProcessedData({ timestamp: new Date('2026-01-10T00:00:00Z'), user: 'test-user-two' }),
    ]);
    expect(result).toHaveLength(92);
    expect(result[0]).toEqual({ date: '2025-11-01', included: 0, additional: 0 });
    expect(result[91]).toEqual({ date: '2026-01-31', included: 0, additional: 0 });
    expect(result.filter(day => day.additional !== 0)).toEqual([
      { date: '2025-12-15', included: 0, additional: 1 },
    ]);
  });

  it('omits rows without daily monetary amounts', () => {
    expect(aggregateDailyConsumption([])).toEqual([]);
    expect(aggregateDailyConsumption([makeProcessedData({ inputTokens: 100 })])).toEqual([]);
  });
});
