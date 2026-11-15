import { renderHook } from '@testing-library/react';

import { useArtifactAnalysis } from '@/hooks/useArtifactAnalysis';
import type { NormalizedRow } from '@/utils/ingestion';
import { buildUsageArtifactsFromRows } from '../helpers/normalizedArtifacts';

import { makeDailyBucketsArtifacts, makeQuotaArtifacts } from '../helpers/makeArtifacts';

function makeUsageRow(
  model: string,
  quantity: number,
  overrides: Partial<NormalizedRow> = {}
): NormalizedRow {
  const day = overrides.day ?? '2026-03-11';

  return {
    date: day,
    user: 'test-user-one',
    model,
    quantity,
    quotaRaw: 'Unknown',
    quotaValue: 'unknown',
    day,
    ...overrides,
  };
}

describe('useArtifactAnalysis core artifacts', () => {
  test('builds sorted model totals through usage artifacts and includes unattributed AI credits', () => {
    const rows = [
      makeUsageRow('model-one', 2),
      makeUsageRow('Code Review', 7, {
        user: '',
        isUnattributedUsage: true,
        usageBucket: 'unattributed_ai_credit',
      }),
      makeUsageRow('model-two', 5, {
        user: 'test-user-two',
      }),
      makeUsageRow('model-one', 4),
    ];

    const { result } = renderHook(() => useArtifactAnalysis({
      usageArtifacts: buildUsageArtifactsFromRows(rows),
      quotaArtifacts: makeQuotaArtifacts([]),
      dailyBucketsArtifacts: makeDailyBucketsArtifacts([]),
    }));

    expect(result.current.analysis.creditsByModel).toEqual([
      { model: 'Code Review', totalCredits: 7 },
      { model: 'model-one', totalCredits: 6 },
      { model: 'model-two', totalCredits: 5 },
    ]);
    expect(result.current.analysis.totalUniqueUsers).toBe(2);
  });
});

describe('useArtifactAnalysis artifacts', () => {
  test('scopes user cost centers to the selected billing period', () => {
    const rows = [
      makeUsageRow('model-one', 2, {
        costCenter: 'test-cost-center-one',
      }),
      makeUsageRow('model-one', 3, {
        day: '2026-04-11',
        costCenter: 'test-cost-center-two',
      }),
    ];
    const usageArtifacts = buildUsageArtifactsFromRows(rows.filter(row => row.day.slice(0, 7) === '2026-03'));
    const quotaArtifacts = makeQuotaArtifacts([{ user: 'test-user-one', quota: 'unknown' }]);
    const dailyBucketsArtifacts = makeDailyBucketsArtifacts([
      { date: '2026-03-11', user: 'test-user-one', used: 2 },
    ]);

    const { result } = renderHook(() => useArtifactAnalysis({
      usageArtifacts,
      quotaArtifacts,
      dailyBucketsArtifacts,
    }));

    expect(result.current.userData).toEqual([
      expect.objectContaining({
        user: 'test-user-one',
        totalCredits: 2,
        costCenter: 'test-cost-center-one',
        costCenters: ['test-cost-center-one'],
      }),
    ]);
  });
});
