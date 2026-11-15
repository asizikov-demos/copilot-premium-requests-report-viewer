import { useState, useMemo, useCallback } from 'react';

import { DailyBucketsArtifacts, buildMonthListFromArtifacts } from '@/utils/ingestion';

/**
 * Hook managing analysis filter state (billing period month selection).
 * It derives supporting metadata (month list, multi-month flag).
 * IMPORTANT: All date handling is assumed to already be UTC in upstream utilities.
 */
export function useAnalysisFilters(dailyBucketsArtifacts: DailyBucketsArtifacts) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // values like '2025-06'

  const meta = useMemo(() => {
    const availableMonths = buildMonthListFromArtifacts(dailyBucketsArtifacts);
    return { availableMonths, hasMultipleMonthsData: availableMonths.length > 1 };
  }, [dailyBucketsArtifacts]);

  const updateSelectedMonths = useCallback((months: string[]) => {
    setSelectedMonths(months);
  }, []);

  return {
    selectedMonths,
    setSelectedMonths: updateSelectedMonths,
    ...meta,
  };
}
