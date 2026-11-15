import { useMemo } from 'react';
import { ProcessedData, AnalysisResults, CodingAgentAnalysis, CodeReviewAnalysis } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import {
  deriveAnalysisFromArtifacts,
  buildDailyCumulativeDataFromArtifacts,
  analyzeCodingAgentAdoptionFromArtifacts,
  analyzeCodeReviewAdoptionFromArtifacts,
  UsageArtifacts,
  QuotaArtifacts,
  DailyBucketsArtifacts
} from '@/utils/ingestion';

interface UseAnalyzedDataArgs {
  baseProcessed: ProcessedData[];
  // Filters
  selectedMonths: string[];
  usageArtifacts: UsageArtifacts;
  quotaArtifacts: QuotaArtifacts;
  dailyBucketsArtifacts: DailyBucketsArtifacts;
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
    const filteredUserRows = filteredAllRows.filter(r => !r.isUnattributedUsage);
    const filtered = filteredUserRows;
    const analysis = deriveAnalysisFromArtifacts(usageArtifacts, quotaArtifacts, dailyBucketsArtifacts);
    const dailyCumulativeData = buildDailyCumulativeDataFromArtifacts(dailyBucketsArtifacts);
    const codingAgentAnalysis = analyzeCodingAgentAdoptionFromArtifacts(usageArtifacts, quotaArtifacts);
    const codeReviewAnalysis = analyzeCodeReviewAdoptionFromArtifacts(usageArtifacts, quotaArtifacts);
    const userData = usageArtifacts.users.map(u => ({
      user: u.user,
      totalCredits: u.totalCredits,
      modelBreakdown: u.modelBreakdown,
      organization: u.organization,
      costCenter: u.costCenter,
      costCenters: u.costCenters,
    })).sort((a, b) => b.totalCredits - a.totalCredits);
    const allModels = Object.keys(usageArtifacts.modelTotals).sort();
    return {
      processedData: filtered,
      aggregateProcessedData: filteredAllRows,
      analysis,
      userData,
      allModels,
      dailyCumulativeData,
      codingAgentAnalysis,
      codeReviewAnalysis
    };
  }, [baseProcessed, selectedMonths, usageArtifacts, quotaArtifacts, dailyBucketsArtifacts]);
}
