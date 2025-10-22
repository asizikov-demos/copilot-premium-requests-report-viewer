import { useState, useMemo, useCallback } from 'react';
import { getAvailableMonths, hasMultipleMonths } from '@/utils/analytics';
import { ProcessedData } from '@/types/csv';

/**
 * Hook managing analysis filter state (billing period month selection).
 * It derives supporting metadata (month list, multi-month flag).
 * IMPORTANT: All date handling is assumed to already be UTC in upstream utilities.
 */
export function useAnalysisFilters(processedData: ProcessedData[]) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // values like '2025-06'

  const meta = useMemo(() => {
    const availableMonths = getAvailableMonths(processedData);
    const hasMultipleMonthsData = hasMultipleMonths(processedData);
    return { availableMonths, hasMultipleMonthsData };
  }, [processedData]);

  const updateSelectedMonths = useCallback((months: string[]) => {
    setSelectedMonths(months);
  }, []);

  return {
    selectedMonths,
    setSelectedMonths: updateSelectedMonths,
    ...meta,
  };
}
