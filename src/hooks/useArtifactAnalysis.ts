import { useMemo } from 'react';
import { AnalysisResults, CodingAgentAnalysis, CodeReviewAnalysis } from '@/types/csv';
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

interface UseArtifactAnalysisArgs {
  usageArtifacts: UsageArtifacts;
  quotaArtifacts: QuotaArtifacts;
  dailyBucketsArtifacts: DailyBucketsArtifacts;
}

interface UseArtifactAnalysisReturn {
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
export function useArtifactAnalysis({ usageArtifacts, quotaArtifacts, dailyBucketsArtifacts }: UseArtifactAnalysisArgs): UseArtifactAnalysisReturn {
  return useMemo(() => {
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
      analysis,
      userData,
      allModels,
      dailyCumulativeData,
      codingAgentAnalysis,
      codeReviewAnalysis
    };
  }, [usageArtifacts, quotaArtifacts, dailyBucketsArtifacts]);
}
