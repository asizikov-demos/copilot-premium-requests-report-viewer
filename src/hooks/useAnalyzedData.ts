import { useMemo } from 'react';
import { ProcessedData, AnalysisResults, PowerUsersAnalysis, CodingAgentAnalysis } from '@/types/csv';
import { analyzeData, analyzeUserData, generateDailyCumulativeData, analyzePowerUsers, analyzeCodingAgentAdoption, filterBySelectedMonths, computeWeeklyQuotaExhaustion } from '@/utils/analytics';
// New artifact-based analytics (incremental migration)
import {
  deriveAnalysisFromArtifacts,
  buildDailyCumulativeDataFromArtifacts,
  analyzePowerUsersFromArtifacts,
  analyzeCodingAgentAdoptionFromArtifacts,
  computeWeeklyQuotaExhaustionFromArtifacts,
  UsageArtifacts,
  QuotaArtifacts,
  DailyBucketsArtifacts
} from '@/utils/ingestion';

interface UseAnalyzedDataArgs {
  // Legacy pathway (to be removed after full migration):
  baseProcessed: ProcessedData[];
  // Filters
  selectedMonths: string[];
  minRequestsThreshold: number;
  // Optional artifact inputs for new ingestion pipeline. When all three are provided,
  // artifact-based analytics will be preferred.
  usageArtifacts?: UsageArtifacts;
  quotaArtifacts?: QuotaArtifacts;
  dailyBucketsArtifacts?: DailyBucketsArtifacts;
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
export function useAnalyzedData({ baseProcessed, selectedMonths, minRequestsThreshold, usageArtifacts, quotaArtifacts, dailyBucketsArtifacts }: UseAnalyzedDataArgs): UseAnalyzedDataReturn {
  return useMemo(() => {
    const artifactsAvailable = !!(
      usageArtifacts && quotaArtifacts && dailyBucketsArtifacts &&
      (usageArtifacts as any).users && (usageArtifacts as any).modelTotals &&
      (quotaArtifacts as any).quotaByUser && (dailyBucketsArtifacts as any).dailyUserTotals
    );

    if (artifactsAvailable) {
      // NOTE: Month filtering currently still relies on legacy processed data (will migrate in later step).
      const filtered = filterBySelectedMonths(baseProcessed, selectedMonths);
      // Build hybrid: analysis & heavy computations from artifacts; retain processed subset for components needing row-level billing fields.
      const analysis = deriveAnalysisFromArtifacts(usageArtifacts!, quotaArtifacts!, dailyBucketsArtifacts!);
      const dailyCumulativeData = buildDailyCumulativeDataFromArtifacts(dailyBucketsArtifacts!);
      const powerUsersAnalysis = analyzePowerUsersFromArtifacts(usageArtifacts!, minRequestsThreshold);
      const codingAgentAnalysis = analyzeCodingAgentAdoptionFromArtifacts(usageArtifacts!, quotaArtifacts!);
      const weeklyExhaustion = computeWeeklyQuotaExhaustionFromArtifacts(dailyBucketsArtifacts!, quotaArtifacts!);
      // User summaries (model breakdown etc.) can be taken directly from usageArtifacts
      const userData = usageArtifacts!.users.map(u => ({ user: u.user, totalRequests: u.totalRequests, modelBreakdown: u.modelBreakdown })).sort((a, b) => b.totalRequests - a.totalRequests);
      const allModels = Object.keys(usageArtifacts!.modelTotals).sort();

      return {
        processedData: filtered, // still provided for components needing row-level details (billing fields)
        analysis,
        userData,
        allModels,
        dailyCumulativeData,
        powerUsersAnalysis,
        codingAgentAnalysis,
        weeklyExhaustion,
      };
    }

    // Legacy pathway
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
  }, [baseProcessed, selectedMonths, minRequestsThreshold, usageArtifacts, quotaArtifacts, dailyBucketsArtifacts]);
}
