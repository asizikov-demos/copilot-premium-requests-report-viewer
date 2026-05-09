import { useMemo } from 'react';
import { ProcessedData, AnalysisResults, CodingAgentAnalysis, CodeReviewAnalysis } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import { buildQuotaBreakdown } from '@/utils/analytics/quota';
import {
  deriveAnalysisFromArtifacts,
  buildDailyCumulativeDataFromArtifacts,
  analyzeCodingAgentAdoptionFromArtifacts,
  analyzeCodeReviewAdoptionFromArtifacts,
  buildUsageArtifactsFromProcessedData,
  computeWeeklyQuotaExhaustionFromArtifacts,
  UsageArtifacts,
  QuotaArtifacts,
  DailyBucketsArtifacts,
  WeeklyQuotaExhaustionBreakdown
} from '@/utils/ingestion';

interface UseAnalyzedDataArgs {
  baseProcessed: ProcessedData[];
  // Filters
  selectedMonths: string[];
  // Optional artifact inputs for new ingestion pipeline. When all three are provided,
  // artifact-based analytics will be preferred.
  usageArtifacts?: UsageArtifacts;
  quotaArtifacts?: QuotaArtifacts;
  dailyBucketsArtifacts?: DailyBucketsArtifacts;
}

interface UseAnalyzedDataReturn {
  processedData: ProcessedData[]; // filtered (retained for billing row-level fields)
  aggregateProcessedData: ProcessedData[]; // filtered rows including non-Copilot aggregate usage
  analysis: AnalysisResults;
  userData: UserSummary[];
  allModels: string[];
  dailyCumulativeData: { date: string; [user: string]: string | number; }[];
  codingAgentAnalysis: CodingAgentAnalysis;
  codeReviewAnalysis: CodeReviewAnalysis;
  weeklyExhaustion: WeeklyQuotaExhaustionBreakdown;
}

/**
 * Encapsulates analytics transformation pipeline with current filter state.
 * Maintains strict UTC semantics by delegating to existing utilities that already
 * avoid local timezone conversions.
 */
export function useAnalyzedData({ baseProcessed, selectedMonths, usageArtifacts, quotaArtifacts, dailyBucketsArtifacts }: UseAnalyzedDataArgs): UseAnalyzedDataReturn {
  return useMemo(() => {
    const filteredAllRows = selectedMonths.length === 0
      ? baseProcessed
      : baseProcessed.filter(r => selectedMonths.includes(r.monthKey));
    const filteredUserRows = filteredAllRows.filter(r => !r.isNonCopilotUsage);
    const artifactsAvailable = !!(
      usageArtifacts && quotaArtifacts && dailyBucketsArtifacts &&
      usageArtifacts.users && usageArtifacts.modelTotals &&
      quotaArtifacts.quotaByUser && dailyBucketsArtifacts.dailyUserTotals
    );

    if (!artifactsAvailable) {
      // Minimal fallback to support legacy tests relying solely on processedData (billing summary, etc.)
      const filtered = filteredUserRows;
      const analysis: AnalysisResults = (() => {
        const userFiltered = filtered;
        if (filteredAllRows.length === 0) return { timeFrame: { start: '', end: '' }, totalUniqueUsers: 0, usersExceedingQuota: 0, requestsByModel: [], quotaBreakdown: { unknown: [], business: [], enterprise: [], mixed: false, suggestedPlan: null } };
        const sorted = [...filteredAllRows].sort((a,b)=> a.epoch - b.epoch);
        const timeFrame = { start: sorted[0].dateKey, end: sorted[sorted.length-1].dateKey };
        const uniqueUsers = new Set(userFiltered.map(r=> r.user));
        const requestsByModelMap = new Map<string, number>();
        for (const r of filteredAllRows) {
          requestsByModelMap.set(r.model, (requestsByModelMap.get(r.model) || 0) + r.requestsUsed);
        }
        const requestsByModel = Array.from(requestsByModelMap.entries()).map(([model,totalRequests])=>({ model, totalRequests })).sort((a,b)=> b.totalRequests - a.totalRequests);
        return { timeFrame, totalUniqueUsers: uniqueUsers.size, usersExceedingQuota: 0, requestsByModel, quotaBreakdown: buildQuotaBreakdown(userFiltered) };
      })();
      return {
        processedData: filtered,
        aggregateProcessedData: filteredAllRows,
        analysis,
        userData: [],
        allModels: Array.from(new Set(filtered.map(r=> r.model))).sort(),
        dailyCumulativeData: [],
        codingAgentAnalysis: { totalUsers: 0, totalUniqueUsers: 0, totalCodingAgentRequests: 0, adoptionRate: 0, users: [] },
        codeReviewAnalysis: { totalUsers: 0, totalUniqueUsers: 0, totalCodeReviewRequests: 0, adoptionRate: 0, users: [] },
        weeklyExhaustion: { totalUsersExhausted: 0, weeks: [] }
      };
    }

    const filtered = filteredUserRows;
    const analysis = deriveAnalysisFromArtifacts(usageArtifacts!, quotaArtifacts!, dailyBucketsArtifacts!);
    const dailyCumulativeData = buildDailyCumulativeDataFromArtifacts(dailyBucketsArtifacts!);
    // When billing period filter is active, derive agent/review analyses from month-sliced data
    const effectiveUsage = selectedMonths.length > 0
      ? buildUsageArtifactsFromProcessedData(filteredAllRows)
      : usageArtifacts!;
    const codingAgentAnalysis = analyzeCodingAgentAdoptionFromArtifacts(effectiveUsage, quotaArtifacts!);
    const codeReviewAnalysis = analyzeCodeReviewAdoptionFromArtifacts(effectiveUsage, quotaArtifacts!);
    const weeklyExhaustion = computeWeeklyQuotaExhaustionFromArtifacts(dailyBucketsArtifacts!, quotaArtifacts!);
    const userData = usageArtifacts!.users.map(u => ({
      user: u.user,
      totalRequests: u.totalRequests,
      modelBreakdown: u.modelBreakdown,
      organization: u.organization,
      costCenter: u.costCenter
    })).sort((a, b) => b.totalRequests - a.totalRequests);
    const allModels = Object.keys(usageArtifacts!.modelTotals).sort();
    return {
      processedData: filtered,
      aggregateProcessedData: filteredAllRows,
      analysis,
      userData,
      allModels,
      dailyCumulativeData,
      codingAgentAnalysis,
      codeReviewAnalysis,
      weeklyExhaustion
    };
  }, [baseProcessed, selectedMonths, usageArtifacts, quotaArtifacts, dailyBucketsArtifacts]);
}
