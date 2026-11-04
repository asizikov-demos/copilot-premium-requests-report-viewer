import {
  buildDailyCodingAgentUsageFromArtifacts,
  buildDailyBucketsArtifactsFromProcessedData,
  type DailyCodingAgentUsageDatum,
} from '@/utils/ingestion';

import { makeDailyBucketsArtifacts } from '../helpers/makeArtifacts';
import { makeProcessedData } from '../helpers/testUtils';

describe('buildDailyCodingAgentUsageFromArtifacts', () => {
  test('aggregates per day and carries cumulative totals through month end', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-01', user: 'test-user-one', used: 2, model: 'coding agent v1' },
      { date: '2025-06-01', user: 'test-user-one', used: 3, model: 'o3-mini' },
      { date: '2025-06-01', user: 'test-user-two', used: 3, model: 'copilot coding agent beta' },
      { date: '2025-06-02', user: 'test-user-one', used: 5, model: 'coding agent v1' },
    ]);
    const result = buildDailyCodingAgentUsageFromArtifacts(artifacts);
    const expected: DailyCodingAgentUsageDatum[] = [
      { date: '2025-06-01', dailyCredits: 5, cumulativeCredits: 5 },
      { date: '2025-06-02', dailyCredits: 5, cumulativeCredits: 10 },
    ];
    expect(result).toHaveLength(30);
    expect(result.slice(0, 2)).toEqual(expected);
    expect(result[29]).toEqual({ date: '2025-06-30', dailyCredits: 0, cumulativeCredits: 10 });
  });

  test('returns empty array when no coding agent usage present', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-01', user: 'test-user-one', used: 4, model: 'o3-mini' },
    ]);
    expect(buildDailyCodingAgentUsageFromArtifacts(artifacts)).toEqual([]);
  });

  test('returns empty array if per-model breakdown missing', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-01', user: 'test-user-one', used: 4, model: 'coding agent v1' },
    ]);
    delete artifacts.dailyUserModelTotals;
    expect(buildDailyCodingAgentUsageFromArtifacts(artifacts)).toEqual([]);
  });

  test('aggregates fractional AI Credits from the canonical per-model breakdown', () => {
    const artifacts = makeDailyBucketsArtifacts([
      {
        date: '2026-03-01',
        user: 'test-user-one',
        used: 12.5,
        model: 'Coding Agent model',
      },
      {
        date: '2026-03-01',
        user: 'test-user-one',
        used: 4,
        model: 'Code Review model',
      },
    ]);

    expect(buildDailyCodingAgentUsageFromArtifacts(artifacts).filter(day => day.dailyCredits > 0)).toEqual([
      { date: '2026-03-01', dailyCredits: 12.5, cumulativeCredits: 12.5 },
    ]);
  });

  test('includes daily rows identified by the Coding Agent SKU', () => {
    const artifacts = buildDailyBucketsArtifactsFromProcessedData([
      makeProcessedData({
        timestamp: new Date('2026-03-01T00:00:00Z'),
        model: 'Claude Sonnet 5',
        sku: 'coding_agent_ai_credit',
        creditsUsed: 3.5,
      }),
      makeProcessedData({
        timestamp: new Date('2026-03-01T00:00:00Z'),
        model: 'GPT-5',
        sku: 'copilot_ai_credit',
        creditsUsed: 4,
      }),
    ]);

    expect(buildDailyCodingAgentUsageFromArtifacts(artifacts).filter(day => day.dailyCredits > 0)).toEqual([
      { date: '2026-03-01', dailyCredits: 3.5, cumulativeCredits: 3.5 },
    ]);
  });
});
