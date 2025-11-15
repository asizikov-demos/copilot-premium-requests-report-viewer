import { buildDailyModelUsageFromArtifacts } from '@/utils/ingestion/analytics';
import type { DailyBucketsArtifacts, UsageArtifacts } from '@/utils/ingestion';

function makeUsageArtifacts(modelTotals: Record<string, number>): UsageArtifacts {
  return {
    users: [],
    userCount: 0,
    modelTotals,
    totalRequests: Object.values(modelTotals).reduce((a, b) => a + b, 0)
  } as unknown as UsageArtifacts;
}

function makeDailyBucketsArtifacts(dates: string[], data: Array<Record<string, Record<string, number>>>): DailyBucketsArtifacts {
  const dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
  dates.forEach((date, idx) => {
    const usersForDay = data[idx];
    const userMap = new Map<string, Map<string, number>>();
    Object.entries(usersForDay).forEach(([user, models]) => {
      const modelMap = new Map<string, number>();
      Object.entries(models).forEach(([model, qty]) => {
        modelMap.set(model, qty);
      });
      userMap.set(user, modelMap);
    });
    dailyUserModelTotals.set(date, userMap);
  });

  return {
    dateRange: {
      min: dates[0],
      max: dates[dates.length - 1]
    },
    dailyUserTotals: new Map(),
    dailyUserModelTotals,
    months: Array.from(new Set(dates.map(d => d.slice(0, 7))))
  } as unknown as DailyBucketsArtifacts;
}

describe('buildDailyModelUsageFromArtifacts', () => {
  it('aggregates per-day per-model totals across users', () => {
    const dates = ['2025-06-01', '2025-06-02'];
    const dailyData: Array<Record<string, Record<string, number>>> = [
      { alice: { 'gpt-4.1': 2 }, bob: { 'gpt-4.1': 1, 'gpt-4.1-mini': 3 } },
      { alice: { 'gpt-4.1': 1 }, bob: { 'gpt-4.1': 0, 'gpt-4.1-mini': 2 } }
    ];
    const usageArtifacts = makeUsageArtifacts({ 'gpt-4.1': 3, 'gpt-4.1-mini': 5 });
    const dailyBucketsArtifacts = makeDailyBucketsArtifacts(dates, dailyData);

    const result = buildDailyModelUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2025-06-01');
    expect(result[0]['gpt-4.1']).toBe(3);
    expect(result[0]['gpt-4.1-mini']).toBe(3);
    expect(result[0].totalRequests).toBe(6);

    expect(result[1].date).toBe('2025-06-02');
    expect(result[1]['gpt-4.1']).toBe(1);
    expect(result[1]['gpt-4.1-mini']).toBe(2);
    expect(result[1].totalRequests).toBe(3);
  });

  it('returns empty array when artifacts incomplete', () => {
    const usageArtifacts = makeUsageArtifacts({});
    const dailyBucketsArtifacts = {
      dateRange: undefined,
      dailyUserTotals: new Map(),
      dailyUserModelTotals: undefined,
      months: []
    } as unknown as DailyBucketsArtifacts;

    const result = buildDailyModelUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);
    expect(result).toEqual([]);
  });

  it('respects full date range including days without activity', () => {
    const dates = ['2025-06-01', '2025-06-02', '2025-06-03'];
    const dailyData: Array<Record<string, Record<string, number>>> = [
      { alice: { 'gpt-4.1': 2 } },
      {},
      { alice: { 'gpt-4.1': 1 } }
    ];
    const usageArtifacts = makeUsageArtifacts({ 'gpt-4.1': 3 });
    const dailyBucketsArtifacts = makeDailyBucketsArtifacts(dates, dailyData);

    const result = buildDailyModelUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    expect(result).toHaveLength(3);
    expect(result[1].date).toBe('2025-06-02');
    expect(result[1]['gpt-4.1']).toBe(0);
    expect(result[1].totalRequests).toBe(0);
  });
});
