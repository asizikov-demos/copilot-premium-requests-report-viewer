import { renderHook } from '@testing-library/react';

import { useAnalysisFilters } from '@/hooks/useAnalysisFilters';

import { makeDailyBucketsArtifacts } from '../helpers/makeArtifacts';
import { makeProcessedData } from '../helpers/testUtils';

describe('useAnalysisFilters', () => {
  it('returns sorted, deduplicated UTC month keys for legacy processed data', () => {
    const rows = [
      makeProcessedData({ timestamp: new Date('2025-07-01T00:00:00Z'), monthKey: '' }),
      makeProcessedData({ timestamp: new Date('2025-06-30T23:59:59Z'), monthKey: '' }),
      makeProcessedData({ timestamp: new Date('2025-07-15T00:00:00Z'), monthKey: '' }),
    ];
    const { result } = renderHook(() => useAnalysisFilters(rows));

    expect(result.current.availableMonths.map(month => month.value)).toEqual(['2025-06', '2025-07']);
    expect(result.current.hasMultipleMonthsData).toBe(true);
  });

  it('returns no months for empty processed data', () => {
    const { result } = renderHook(() => useAnalysisFilters([]));

    expect(result.current.availableMonths).toEqual([]);
    expect(result.current.hasMultipleMonthsData).toBe(false);
  });

  it('does not flag duplicate rows in a single month as multi-month data', () => {
    const rows = [
      makeProcessedData({ timestamp: new Date('2025-06-01T00:00:00Z'), monthKey: '' }),
      makeProcessedData({ timestamp: new Date('2025-06-30T23:59:59Z'), monthKey: '' }),
    ];
    const { result } = renderHook(() => useAnalysisFilters(rows));

    expect(result.current.availableMonths.map(month => month.value)).toEqual(['2025-06']);
    expect(result.current.hasMultipleMonthsData).toBe(false);
  });

  it('prefers artifact months over processed data', () => {
    const rows = [makeProcessedData({ timestamp: new Date('2025-06-01T00:00:00Z') })];
    const artifacts = makeDailyBucketsArtifacts([], { months: ['2025-07', '2025-08'] });
    const { result } = renderHook(() => useAnalysisFilters(rows, artifacts));

    expect(result.current.availableMonths.map(month => month.value)).toEqual(['2025-07', '2025-08']);
    expect(result.current.hasMultipleMonthsData).toBe(true);
  });

  it('falls back to processed data when artifact months are empty', () => {
    const rows = [makeProcessedData({ timestamp: new Date('2025-06-30T23:59:59Z'), monthKey: '' })];
    const artifacts = makeDailyBucketsArtifacts();
    const { result } = renderHook(() => useAnalysisFilters(rows, artifacts));

    expect(result.current.availableMonths.map(month => month.value)).toEqual(['2025-06']);
    expect(result.current.hasMultipleMonthsData).toBe(false);
  });
});
