import { act, renderHook } from '@testing-library/react';

import { useAnalysisFilters } from '@/hooks/useAnalysisFilters';

import { makeDailyBucketsArtifacts } from '../helpers/makeArtifacts';

describe('useAnalysisFilters', () => {
  it('enumerates report months from artifacts without retained rows', () => {
    const artifacts = makeDailyBucketsArtifacts([], { months: ['2025-06', '2025-07'] });
    const { result } = renderHook(() => useAnalysisFilters(artifacts));
    expect(result.current.availableMonths.map(month => month.value)).toEqual(['2025-06', '2025-07']);
    expect(result.current.hasMultipleMonthsData).toBe(true);
    expect(result.current.selectedMonths).toEqual([]);
    act(() => result.current.setSelectedMonths(['2025-07']));
    expect(result.current.selectedMonths).toEqual(['2025-07']);
    expect(result.current.availableMonths).toHaveLength(2);
  });

  it('returns no months for empty artifacts', () => {
    const { result } = renderHook(() => useAnalysisFilters(makeDailyBucketsArtifacts()));
    expect(result.current.availableMonths).toEqual([]);
    expect(result.current.hasMultipleMonthsData).toBe(false);
  });

  it('does not flag a single report month as multi-month data', () => {
    const artifacts = makeDailyBucketsArtifacts([], { months: ['2025-06'] });
    const { result } = renderHook(() => useAnalysisFilters(artifacts));
    expect(result.current.availableMonths.map(month => month.value)).toEqual(['2025-06']);
    expect(result.current.hasMultipleMonthsData).toBe(false);
  });
});
