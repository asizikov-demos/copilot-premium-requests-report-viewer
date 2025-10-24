import { useState, useMemo, useCallback } from 'react';
import { DailyBucketsArtifacts, buildMonthListFromArtifacts } from '@/utils/ingestion';
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
      const availableMonths = buildMonthListFromArtifacts(dailyBucketsArtifacts);
      return { availableMonths, hasMultipleMonthsData: availableMonths.length > 1 };
    }
    // Legacy fallback: derive months from processedData inline (avoid importing deprecated utilities)
    const monthsSet = new Set<string>();
    for (const row of processedData) {
      const key = row.monthKey || `${row.timestamp.getUTCFullYear()}-${String(row.timestamp.getUTCMonth()+1).padStart(2,'0')}`;
      monthsSet.add(key);
    }
    const sorted = Array.from(monthsSet).sort();
    const MONTH_NAMES = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    const availableMonths = sorted.map(key => {
      const [yearStr, monthStr] = key.split('-');
      const monthIndex = parseInt(monthStr, 10) - 1;
      return { value: key, label: `${MONTH_NAMES[monthIndex]} ${yearStr}` };
    });
    return { availableMonths, hasMultipleMonthsData: availableMonths.length > 1 };
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
