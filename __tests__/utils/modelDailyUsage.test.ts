import { buildDailyModelAicUsageFromArtifacts, buildDailyModelUsageFromArtifacts } from '@/utils/ingestion/analytics';
import type { DailyBucketsArtifacts, UsageArtifacts } from '@/utils/ingestion';
import { makeUsageArtifacts, makeDailyBucketsArtifacts } from '../helpers/makeArtifacts';

function makeUsageFromModelTotals(modelTotals: Record<string, number>): UsageArtifacts {
  const total = Object.values(modelTotals).reduce((a, b) => a + b, 0);
  const users = Object.keys(modelTotals).length
    ? [{ user: 'test-user-one', totalRequests: total, modelBreakdown: modelTotals }]
    : [];
  return makeUsageArtifacts(users);
}

function makeDailyBucketsFromNested(dates: string[], data: Array<Record<string, Record<string, number>>>): DailyBucketsArtifacts {
  const entries: Array<{ date: string; user: string; used: number; model: string }> = [];
  dates.forEach((date, idx) => {
    const usersForDay = data[idx] || {};
    Object.entries(usersForDay).forEach(([user, models]) => {
      Object.entries(models).forEach(([model, qty]) => {
        entries.push({ date, user, used: qty, model });
      });
    });
  });
  return makeDailyBucketsArtifacts(entries);
}

function cloneDailyModelTotals(
  source: Map<string, Map<string, Map<string, number>>>
): Map<string, Map<string, Map<string, number>>> {
  // Clone date → user → model → value maps so tests catch use of the wrong artifact field.
  return new Map(
    Array.from(source.entries()).map(([date, userMap]) => [
      date,
      new Map(
        Array.from(userMap.entries()).map(([user, modelMap]) => [
          user,
          new Map(modelMap),
        ])
      ),
    ])
  );
}

function makeDailyAicBucketsFromNested(dates: string[], data: Array<Record<string, Record<string, number>>>): DailyBucketsArtifacts {
  const artifacts = makeDailyBucketsFromNested(dates, data);
  return {
    ...artifacts,
    dailyUserAicModelTotals: cloneDailyModelTotals(artifacts.dailyUserModelTotals),
  };
}

describe('buildDailyModelUsageFromArtifacts', () => {
  it('aggregates per-day per-model totals across users', () => {
    const dates = ['2025-06-01', '2025-06-02'];
    const dailyData: Array<Record<string, Record<string, number>>> = [
      { alice: { 'gpt-4.1': 2 }, bob: { 'gpt-4.1': 1, 'gpt-4.1-mini': 3 } },
      { alice: { 'gpt-4.1': 1 }, bob: { 'gpt-4.1': 0, 'gpt-4.1-mini': 2 } }
    ];
    const usageArtifacts = makeUsageFromModelTotals({ 'gpt-4.1': 3, 'gpt-4.1-mini': 5 });
    const dailyBucketsArtifacts = makeDailyBucketsFromNested(dates, dailyData);

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
    const usageArtifacts = makeUsageFromModelTotals({});
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
    const usageArtifacts = makeUsageFromModelTotals({ 'gpt-4.1': 3 });
    const dailyBucketsArtifacts = makeDailyBucketsFromNested(dates, dailyData);

    const result = buildDailyModelUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    expect(result).toHaveLength(3);
    expect(result[1].date).toBe('2025-06-02');
    expect(result[1]['gpt-4.1']).toBe(0);
    expect(result[1].totalRequests).toBe(0);
  });
});

describe('buildDailyModelAicUsageFromArtifacts', () => {
  it('returns empty array for empty artifacts', () => {
    const usageArtifacts = makeUsageFromModelTotals({});
    const dailyBucketsArtifacts = makeDailyAicBucketsFromNested([], []);

    const result = buildDailyModelAicUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    expect(result).toEqual([]);
  });

  it('returns empty array when AIC model artifacts are missing', () => {
    const usageArtifacts = makeUsageFromModelTotals({ 'test-model-one': 1 });
    const dailyBucketsArtifacts = {
      dateRange: { min: '2025-06-01', max: '2025-06-01' },
      dailyUserTotals: new Map(),
      dailyUserModelTotals: new Map(),
      dailyUserAicModelTotals: undefined,
      months: ['2025-06'],
    } as unknown as DailyBucketsArtifacts;

    const result = buildDailyModelAicUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    expect(result).toEqual([]);
  });

  it('aggregates single-day AIC model totals across users', () => {
    const dates = ['2025-06-30'];
    const dailyData: Array<Record<string, Record<string, number>>> = [
      { 'test-user-one': { 'test-model-one': 2.5 }, 'test-user-two': { 'test-model-one': 1.25 } }
    ];
    const usageArtifacts = makeUsageFromModelTotals({ 'test-model-one': 3.75 });
    const dailyBucketsArtifacts = makeDailyAicBucketsFromNested(dates, dailyData);

    const result = buildDailyModelAicUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-06-30');
    expect(result[0]['test-model-one']).toBe(3.75);
    expect(result[0].totalRequests).toBe(3.75);
  });

  it('builds dense multi-day UTC date-keyed AIC model totals for multiple models', () => {
    const dates = ['2025-06-30', '2025-07-01', '2025-07-02'];
    const dailyData: Array<Record<string, Record<string, number>>> = [
      { 'test-user-one': { 'test-model-one': 2, 'test-model-two': 1 } },
      {},
      { 'test-user-two': { 'test-model-one': 0.5, 'test-model-two': 3 } }
    ];
    const usageArtifacts = makeUsageFromModelTotals({ 'test-model-one': 2.5, 'test-model-two': 4 });
    const dailyBucketsArtifacts = makeDailyAicBucketsFromNested(dates, dailyData);

    const result = buildDailyModelAicUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    expect(result.map((row) => row.date)).toEqual(['2025-06-30', '2025-07-01', '2025-07-02']);
    expect(result[0]['test-model-one']).toBe(2);
    expect(result[0]['test-model-two']).toBe(1);
    expect(result[0].totalRequests).toBe(3);
    expect(result[1]['test-model-one']).toBe(0);
    expect(result[1]['test-model-two']).toBe(0);
    expect(result[1].totalRequests).toBe(0);
    expect(result[2]['test-model-one']).toBe(0.5);
    expect(result[2]['test-model-two']).toBe(3);
    expect(result[2].totalRequests).toBe(3.5);
  });
});
