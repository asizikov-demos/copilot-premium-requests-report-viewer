import { useMemo } from 'react';
import { ProcessedData, AnalysisResults, PowerUsersAnalysis, CodingAgentAnalysis } from '@/types/csv';
import { analyzeData, analyzeUserData, generateDailyCumulativeData, analyzePowerUsers, analyzeCodingAgentAdoption, filterBySelectedMonths, computeWeeklyQuotaExhaustion } from '@/utils/analytics';

interface UseAnalyzedDataArgs {
  baseProcessed: ProcessedData[]; // already result of processCSVData(csvRaw)
  selectedMonths: string[];
  minRequestsThreshold: number;
}

interface UseAnalyzedDataReturn {
  processedData: ProcessedData[]; // filtered
  analysis: AnalysisResults;
  userData: ReturnType<typeof analyzeUserData>;
  allModels: string[];
  dailyCumulativeData: ReturnType<typeof generateDailyCumulativeData>;
  powerUsersAnalysis: PowerUsersAnalysis;
  codingAgentAnalysis: CodingAgentAnalysis;
  weeklyExhaustion: ReturnType<typeof computeWeeklyQuotaExhaustion>;
}

/**
 * Encapsulates analytics transformation pipeline with current filter state.
 * Maintains strict UTC semantics by delegating to existing utilities that already
 * avoid local timezone conversions.
 */
export function useAnalyzedData({ baseProcessed, selectedMonths, minRequestsThreshold }: UseAnalyzedDataArgs): UseAnalyzedDataReturn {
  return useMemo(() => {
    // Apply selected billing months (if any)
    const filtered = filterBySelectedMonths(baseProcessed, selectedMonths);

    const analysis = analyzeData(filtered);
    const userData = analyzeUserData(filtered);
    const allModels = Array.from(new Set(filtered.map(d => d.model))).sort();
    const dailyCumulativeData = generateDailyCumulativeData(filtered);
    const powerUsersAnalysis = analyzePowerUsers(filtered, minRequestsThreshold);
    const codingAgentAnalysis = analyzeCodingAgentAdoption(filtered);
    const weeklyExhaustion = computeWeeklyQuotaExhaustion(filtered);

    return {
      processedData: filtered,
      analysis,
      userData,
      allModels,
      dailyCumulativeData,
      powerUsersAnalysis,
      codingAgentAnalysis,
      weeklyExhaustion,
    };
  }, [baseProcessed, selectedMonths, minRequestsThreshold]);
}
