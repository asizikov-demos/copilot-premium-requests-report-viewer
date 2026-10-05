import { renderHook } from '@testing-library/react';

import { useAnalysisFilters } from '@/hooks/useAnalysisFilters';
import { getAvailableMonths } from '@/utils/analytics/filters';

import { makeProcessedData } from '../helpers/testUtils';

jest.mock('@/utils/analytics/filters', () => {
  const actual = jest.requireActual<typeof import('@/utils/analytics/filters')>('@/utils/analytics/filters');
  return { ...actual, getAvailableMonths: jest.fn(actual.getAvailableMonths) };
});

describe('useAnalysisFilters', () => {
  it('uses the shared UTC-safe month list for legacy processed data', () => {
    const rows = [
      makeProcessedData({ timestamp: new Date('2025-07-01T00:00:00Z'), monthKey: '' }),
      makeProcessedData({ timestamp: new Date('2025-06-30T23:59:59Z'), monthKey: '' }),
      makeProcessedData({ timestamp: new Date('2025-07-15T00:00:00Z'), monthKey: '' }),
    ];
    const { result } = renderHook(() => useAnalysisFilters(rows));

    expect(getAvailableMonths).toHaveBeenCalledWith(rows);
    expect(result.current.availableMonths).toEqual([
      { value: '2025-06', label: 'June 2025' },
      { value: '2025-07', label: 'July 2025' },
    ]);
    expect(result.current.hasMultipleMonthsData).toBe(true);
  });
});
