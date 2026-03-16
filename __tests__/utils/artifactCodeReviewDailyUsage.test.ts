import { buildDailyCodeReviewUsageFromArtifacts, DailyBucketsArtifacts } from '@/utils/ingestion';
import { DailyCodingAgentUsageDatum } from '@/utils/analytics/codingAgent';

describe('buildDailyCodeReviewUsageFromArtifacts', () => {
  function makeArtifacts(): DailyBucketsArtifacts {
    const dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
    // 2025-06-01
    const day1 = new Map<string, Map<string, number>>();
    const u1Models = new Map<string, number>();
    u1Models.set('code review v1', 4);
    u1Models.set('o3-mini', 3); // non-review model should be ignored
    day1.set('u1', u1Models);
    const u2Models = new Map<string, number>();
    u2Models.set('Code Review beta', 2); // case-insensitive match
    day1.set('u2', u2Models);
    dailyUserModelTotals.set('2025-06-01', day1);
    // 2025-06-02
    const day2 = new Map<string, Map<string, number>>();
    const u1d2 = new Map<string, number>();
    u1d2.set('code review v1', 7);
    day2.set('u1', u1d2);
    dailyUserModelTotals.set('2025-06-02', day2);
    return {
      dailyUserTotals: new Map(),
      dailyUserModelTotals,
      dateRange: { min: '2025-06-01', max: '2025-06-02' }
    };
  }

  test('aggregates per day and computes cumulative totals', () => {
    const artifacts = makeArtifacts();
    const result = buildDailyCodeReviewUsageFromArtifacts(artifacts);
    const expected: DailyCodingAgentUsageDatum[] = [
      { date: '2025-06-01', dailyRequests: 6, cumulativeRequests: 6 }, // 4 + 2 (ignores o3-mini)
      { date: '2025-06-02', dailyRequests: 7, cumulativeRequests: 13 }
    ];
    expect(result).toEqual(expected);
  });

  test('sorts results by date', () => {
    const dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
    // Insert out of order
    const day2 = new Map<string, Map<string, number>>();
    const u1d2 = new Map<string, number>();
    u1d2.set('code review v1', 3);
    day2.set('u1', u1d2);
    dailyUserModelTotals.set('2025-06-03', day2);

    const day1 = new Map<string, Map<string, number>>();
    const u1d1 = new Map<string, number>();
    u1d1.set('code review v1', 1);
    day1.set('u1', u1d1);
    dailyUserModelTotals.set('2025-06-01', day1);

    const artifacts: DailyBucketsArtifacts = {
      dailyUserTotals: new Map(),
      dailyUserModelTotals,
      dateRange: { min: '2025-06-01', max: '2025-06-03' }
    };
    const result = buildDailyCodeReviewUsageFromArtifacts(artifacts);
    expect(result[0].date).toBe('2025-06-01');
    expect(result[1].date).toBe('2025-06-03');
  });

  test('filters out days with zero code review usage', () => {
    const dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
    const day1 = new Map<string, Map<string, number>>();
    const u1Models = new Map<string, number>();
    u1Models.set('code review v1', 2);
    day1.set('u1', u1Models);
    dailyUserModelTotals.set('2025-06-01', day1);

    // Day with no code review usage
    const day2 = new Map<string, Map<string, number>>();
    const u1d2 = new Map<string, number>();
    u1d2.set('o3-mini', 5);
    day2.set('u1', u1d2);
    dailyUserModelTotals.set('2025-06-02', day2);

    const artifacts: DailyBucketsArtifacts = {
      dailyUserTotals: new Map(),
      dailyUserModelTotals,
      dateRange: { min: '2025-06-01', max: '2025-06-02' }
    };
    const result = buildDailyCodeReviewUsageFromArtifacts(artifacts);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-06-01');
  });

  test('returns empty array when no code review usage present', () => {
    const dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
    const day = new Map<string, Map<string, number>>();
    const u1Models = new Map<string, number>();
    u1Models.set('o3-mini', 4);
    day.set('u1', u1Models);
    dailyUserModelTotals.set('2025-06-01', day);
    const artifacts: DailyBucketsArtifacts = {
      dailyUserTotals: new Map(),
      dailyUserModelTotals,
      dateRange: { min: '2025-06-01', max: '2025-06-01' }
    };
    expect(buildDailyCodeReviewUsageFromArtifacts(artifacts)).toEqual([]);
  });

  test('returns empty array if per-model breakdown missing', () => {
    const artifacts: DailyBucketsArtifacts = {
      dailyUserTotals: new Map(),
      dateRange: { min: '2025-06-01', max: '2025-06-02' }
    };
    expect(buildDailyCodeReviewUsageFromArtifacts(artifacts)).toEqual([]);
  });
});
