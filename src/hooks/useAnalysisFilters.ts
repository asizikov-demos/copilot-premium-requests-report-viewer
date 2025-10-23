import { useState, useMemo, useCallback } from 'react';
import { getAvailableMonths, hasMultipleMonths } from '@/utils/analytics';
import { DailyBucketsArtifacts } from '@/utils/ingestion';
import { ProcessedData } from '@/types/csv';

/**
 * Hook managing analysis filter state (billing period month selection).
 * It derives supporting metadata (month list, multi-month flag).
 * IMPORTANT: All date handling is assumed to already be UTC in upstream utilities.
 */
export function useAnalysisFilters(processedData: ProcessedData[], dailyBucketsArtifacts?: DailyBucketsArtifacts) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // values like '2025-06'

  const meta = useMemo(() => {
    // If artifact months available, prefer them for O(1) month enumeration.
    if (dailyBucketsArtifacts?.months && dailyBucketsArtifacts.months.length > 0) {
      const MONTH_NAMES = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
      ];
      const availableMonths = dailyBucketsArtifacts.months.map(key => {
        const [yearStr, monthStr] = key.split('-');
        const monthIndex = parseInt(monthStr, 10) - 1;
        return { value: key, label: `${MONTH_NAMES[monthIndex]} ${yearStr}` };
      });
      return { 
        availableMonths, 
        hasMultipleMonthsData: availableMonths.length > 1 
      };
    }
    const availableMonths = getAvailableMonths(processedData);
    const hasMultipleMonthsData = hasMultipleMonths(processedData);
    return { availableMonths, hasMultipleMonthsData };
  }, [processedData, dailyBucketsArtifacts]);

  const updateSelectedMonths = useCallback((months: string[]) => {
    setSelectedMonths(months);
  }, []);

  return {
    selectedMonths,
    setSelectedMonths: updateSelectedMonths,
    ...meta,
  };
}
