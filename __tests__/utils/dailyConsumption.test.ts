import { aggregateDailyConsumption as selectDailyConsumption } from '@/utils/dailyConsumption';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';
import { makeModelDailyArtifacts } from '../helpers/modelDailyArtifacts';

function aggregateDailyConsumption(rows: NormalizedRow[], periodRows = rows) {
  return selectDailyConsumption(makeModelDailyArtifacts(rows).dailyConsumption, periodRows[0]?.day.slice(0, 7));
}

describe('aggregateDailyConsumption', () => {
  it('sums reported USD amounts across users, products, and unattributed usage in UTC day order', () => {
    const rows = [
      makeNormalizedRow({
        day: '2026-06-01',
        discountAmount: 0,
        netAmount: 2.3456,
      }),
      makeNormalizedRow({
        day: '2026-06-30',
        discountAmount: 1.2345,
        netAmount: 0.5,
        quantity: 999,
        aicGrossAmount: 999,
      }),
      makeNormalizedRow({
        day: '2026-06-30',
        user: 'test-user-two',
        product: 'spark',
        discountAmount: 2,
        netAmount: 1,
      }),
      makeNormalizedRow({
        day: '2026-06-30',
        user: '',
        model: 'Code Review',
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
        discountAmount: 3,
        netAmount: 2,
      }),
    ];

    const result = aggregateDailyConsumption(rows);
    expect(result).toHaveLength(30);
    expect(result[0]).toEqual({ date: '2026-06-01', included: 0, additional: 2.3456 });
    expect(result[29].date).toBe('2026-06-30');
    expect(result[29].included).toBeCloseTo(6.2345);
    expect(result[29].additional).toBe(3.5);
    expect(result[28]).toEqual({ date: '2026-06-29', included: 0, additional: 0 });
  });

  it('retains reported zeros and optional monetary fields without inferring costs', () => {
    const result = aggregateDailyConsumption([
      makeNormalizedRow({ discountAmount: 0, netAmount: 0 }),
      makeNormalizedRow({ discountAmount: 1 }),
      makeNormalizedRow({ netAmount: 2 }),
      makeNormalizedRow({
        day: '2025-06-02',
        grossAmount: 100,
        quantity: 100,
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
      makeNormalizedRow({ day: `${month}-15`, netAmount: 1 }),
    ]);
    expect(result).toHaveLength(days);
    expect(result[0]).toEqual({ date: `${month}-01`, included: 0, additional: 0 });
    expect(result[14]).toEqual({ date: `${month}-15`, included: 0, additional: 1 });
    expect(result[days - 1]).toEqual({ date: `${month}-${days}`, included: 0, additional: 0 });
  });

  it('uses the full report month even when the user has no usage on its boundary days', () => {
    const userRows = [
      makeNormalizedRow({ day: '2025-12-15', netAmount: 1 }),
    ];
    const result = aggregateDailyConsumption(userRows, [
      ...userRows,
      makeNormalizedRow({ day: '2025-12-01', user: 'test-user-two' }),
      makeNormalizedRow({ day: '2025-12-31', user: 'test-user-two' }),
    ]);
    expect(result).toHaveLength(31);
    expect(result[0]).toEqual({ date: '2025-12-01', included: 0, additional: 0 });
    expect(result[30]).toEqual({ date: '2025-12-31', included: 0, additional: 0 });
    expect(result.filter(day => day.additional !== 0)).toEqual([
      { date: '2025-12-15', included: 0, additional: 1 },
    ]);
  });

  it('omits rows without daily monetary amounts', () => {
    expect(aggregateDailyConsumption([])).toEqual([]);
    expect(aggregateDailyConsumption([makeNormalizedRow({ inputTokens: 100 })])).toEqual([]);
  });

  it('preserves the timeline for unordered report dates without mutating report rows', () => {
    const userRows = [
      makeNormalizedRow({ day: '2025-12-15', netAmount: 1 }),
    ];
    const periodRows = [
      makeNormalizedRow({ day: '2025-12-20' }),
      ...userRows,
      makeNormalizedRow({ day: '2025-12-21' }),
      makeNormalizedRow({ day: '2025-12-10' }),
    ];
    const originalRows = [...periodRows];
    const result = aggregateDailyConsumption(userRows, periodRows);

    expect(result).toHaveLength(31);
    expect(result[0]).toEqual({ date: '2025-12-01', included: 0, additional: 0 });
    expect(result[30]).toEqual({ date: '2025-12-31', included: 0, additional: 0 });
    expect(result.filter(day => day.additional !== 0)).toEqual([
      { date: '2025-12-15', included: 0, additional: 1 },
    ]);
    expect(periodRows).toEqual(originalRows);
    expect(aggregateDailyConsumption(userRows, [])).toEqual([]);
  });
});
