import { useState, useMemo, useCallback } from 'react';

import type { ProcessedData } from '@/types/csv';
import { DailyBucketsArtifacts, buildMonthListFromArtifacts } from '@/utils/ingestion';
import { getMonthKey } from '@/utils/analytics/filters';
import { monthKeyToLabel } from '@/utils/dateKeys';

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
    // Legacy fallback: derive months from processedData using the shared UTC-safe helpers.
    const monthsSet = new Set<string>();
    for (const row of processedData) {
      monthsSet.add(getMonthKey(row));
    }
    const sorted = Array.from(monthsSet).sort();
    const availableMonths = sorted.map(key => ({ value: key, label: monthKeyToLabel(key) }));
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
