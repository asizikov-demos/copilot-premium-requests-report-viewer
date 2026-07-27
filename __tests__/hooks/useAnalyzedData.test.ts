import { renderHook } from '@testing-library/react';

import { useAnalyzedData } from '@/hooks/useAnalyzedData';
import type { ProcessedData } from '@/types/csv';

function makeProcessedData(
  model: string,
  requestsUsed: number,
  overrides: Partial<ProcessedData> = {}
): ProcessedData {
  const dateKey = overrides.dateKey ?? '2026-03-11';

  return {
    timestamp: new Date(`${dateKey}T00:00:00.000Z`),
    user: 'test-user-one',
    model,
    requestsUsed,
    exceedsQuota: false,
    totalQuota: 'Unknown',
    quotaValue: 'unknown',
    iso: `${dateKey}T00:00:00.000Z`,
    dateKey,
    monthKey: dateKey.slice(0, 7),
    epoch: new Date(`${dateKey}T00:00:00.000Z`).getTime(),
    ...overrides,
  };
}

describe('useAnalyzedData fallback', () => {
  test('builds sorted model totals through usage artifacts and includes non-Copilot usage', () => {
    const baseProcessed = [
      makeProcessedData('model-one', 2),
      makeProcessedData('Code Review', 7, {
        user: '',
        isNonCopilotUsage: true,
        usageBucket: 'non_copilot_code_review',
      }),
      makeProcessedData('model-two', 5, {
        user: 'test-user-two',
      }),
      makeProcessedData('model-one', 4),
    ];

    const { result } = renderHook(() => useAnalyzedData({
      baseProcessed,
      selectedMonths: [],
    }));

    expect(result.current.analysis.requestsByModel).toEqual([
      { model: 'Code Review', totalRequests: 7 },
      { model: 'model-one', totalRequests: 6 },
      { model: 'model-two', totalRequests: 5 },
    ]);
    expect(result.current.analysis.totalUniqueUsers).toBe(2);
  });
});
