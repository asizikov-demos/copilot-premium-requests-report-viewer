import { useState, useMemo, useCallback } from 'react';
import { containsJune2025Data, getAvailableMonths, hasMultipleMonths } from '@/utils/analytics';
import { ProcessedData } from '@/types/csv';

/**
 * Hook managing analysis filter state (exclude early June 2025 & billing period month selection).
 * It derives supporting metadata (availability of June filter, month list, multi-month flag).
 * IMPORTANT: All date handling is assumed to already be UTC in upstream utilities.
 */
export function useAnalysisFilters(processedData: ProcessedData[]) {
  const [excludeEarlyJune, setExcludeEarlyJune] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // values like '2025-06'

  const meta = useMemo(() => {
    const hasJune2025Data = containsJune2025Data(processedData);
    const availableMonths = getAvailableMonths(processedData);
    const hasMultipleMonthsData = hasMultipleMonths(processedData);
    return { hasJune2025Data, availableMonths, hasMultipleMonthsData };
  }, [processedData]);

  const toggleExcludeEarlyJune = useCallback((value: boolean) => {
    setExcludeEarlyJune(value);
  }, []);

  const updateSelectedMonths = useCallback((months: string[]) => {
    setSelectedMonths(months);
  }, []);

  return {
    excludeEarlyJune,
    selectedMonths,
    setExcludeEarlyJune: toggleExcludeEarlyJune,
    setSelectedMonths: updateSelectedMonths,
    ...meta,
  };
}
