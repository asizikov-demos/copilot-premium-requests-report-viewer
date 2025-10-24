import { buildDailyCodingAgentUsageFromArtifacts, DailyBucketsArtifacts } from '@/utils/ingestion';
import { DailyCodingAgentUsageDatum } from '@/utils/analytics/codingAgent';

describe('buildDailyCodingAgentUsageFromArtifacts', () => {
  function makeArtifacts(): DailyBucketsArtifacts {
    const dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
    // 2025-06-01
    const day1 = new Map<string, Map<string, number>>();
    const u1Models = new Map<string, number>();
    u1Models.set('coding agent v1', 2);
    u1Models.set('o3-mini', 3); // non-coding agent should be ignored
    day1.set('u1', u1Models);
    const u2Models = new Map<string, number>();
    u2Models.set('padawan-beta', 3); // counts toward coding agent
    day1.set('u2', u2Models);
    dailyUserModelTotals.set('2025-06-01', day1);
    // 2025-06-02
    const day2 = new Map<string, Map<string, number>>();
    const u1d2 = new Map<string, number>();
    u1d2.set('coding agent v1', 5);
    day2.set('u1', u1d2);
    dailyUserModelTotals.set('2025-06-02', day2);
    return {
      dailyUserTotals: new Map(), // not needed for this helper
      dailyUserModelTotals,
      dateRange: { min: '2025-06-01', max: '2025-06-02' }
    };
  }

  test('aggregates per day and computes cumulative matching legacy semantics', () => {
    const artifacts = makeArtifacts();
    const result = buildDailyCodingAgentUsageFromArtifacts(artifacts);
    const expected: DailyCodingAgentUsageDatum[] = [
      { date: '2025-06-01', dailyRequests: 5, cumulativeRequests: 5 }, // 2 + 3 padawan (ignores o3-mini)
      { date: '2025-06-02', dailyRequests: 5, cumulativeRequests: 10 }
    ];
    expect(result).toEqual(expected);
  });

  test('returns empty array when no coding agent usage present', () => {
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
    expect(buildDailyCodingAgentUsageFromArtifacts(artifacts)).toEqual([]);
  });

  test('returns empty array if per-model breakdown missing', () => {
    const artifacts: DailyBucketsArtifacts = {
      dailyUserTotals: new Map(),
      dateRange: { min: '2025-06-01', max: '2025-06-02' }
    };
    expect(buildDailyCodingAgentUsageFromArtifacts(artifacts)).toEqual([]);
  });
});
