import {
  buildDailyCodeReviewAicUsageFromArtifacts,
  buildDailyCodeReviewUsageFromArtifacts,
  type DailyCodingAgentUsageDatum,
} from '@/utils/ingestion';

import { makeDailyBucketsArtifacts } from '../helpers/makeArtifacts';

describe('buildDailyCodeReviewUsageFromArtifacts', () => {
  test('aggregates per day and computes cumulative totals', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-01', user: 'test-user-one', used: 4, model: 'code review v1' },
      { date: '2025-06-01', user: 'test-user-one', used: 3, model: 'o3-mini' },
      { date: '2025-06-01', user: 'test-user-two', used: 2, model: 'Code Review beta' },
      { date: '2025-06-02', user: 'test-user-one', used: 7, model: 'code review v1' },
    ]);
    const result = buildDailyCodeReviewUsageFromArtifacts(artifacts);
    const expected: DailyCodingAgentUsageDatum[] = [
      { date: '2025-06-01', dailyRequests: 6, cumulativeRequests: 6 },
      { date: '2025-06-02', dailyRequests: 7, cumulativeRequests: 13 },
    ];
    expect(result).toEqual(expected);
  });

  test('sorts results by date', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-03', user: 'test-user-one', used: 3, model: 'code review v1' },
      { date: '2025-06-01', user: 'test-user-one', used: 1, model: 'code review v1' },
    ]);
    const result = buildDailyCodeReviewUsageFromArtifacts(artifacts);
    expect(result[0].date).toBe('2025-06-01');
    expect(result[1].date).toBe('2025-06-03');
  });

  test('filters out days with zero code review usage', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-01', user: 'test-user-one', used: 2, model: 'code review v1' },
      { date: '2025-06-02', user: 'test-user-one', used: 5, model: 'o3-mini' },
    ]);
    const result = buildDailyCodeReviewUsageFromArtifacts(artifacts);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-06-01');
  });

  test('returns empty array when no code review usage present', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-01', user: 'test-user-one', used: 4, model: 'o3-mini' },
    ]);
    expect(buildDailyCodeReviewUsageFromArtifacts(artifacts)).toEqual([]);
  });

  test('returns empty array if per-model breakdown missing', () => {
    const artifacts = makeDailyBucketsArtifacts([
      { date: '2025-06-01', user: 'test-user-one', used: 4, model: 'code review v1' },
    ]);
    delete artifacts.dailyUserModelTotals;
    expect(buildDailyCodeReviewUsageFromArtifacts(artifacts)).toEqual([]);
  });

  test('aggregates AI Credits from the AI Credits per-model breakdown', () => {
    const artifacts = makeDailyBucketsArtifacts([
      {
        date: '2026-03-01',
        user: 'test-user-one',
        used: 8.25,
        model: 'Code Review model',
        isAic: true,
      },
      {
        date: '2026-03-01',
        user: 'test-user-one',
        used: 3,
        model: 'Coding Agent model',
        isAic: true,
      },
    ]);

    expect(buildDailyCodeReviewAicUsageFromArtifacts(artifacts)).toEqual([
      { date: '2026-03-01', dailyRequests: 8.25, cumulativeRequests: 8.25 },
    ]);
  });
});
