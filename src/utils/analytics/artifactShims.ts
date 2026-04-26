import { ProcessedData } from '@/types/csv';
import {
  buildDailyBucketsArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  buildUsageArtifactsFromProcessedData,
  computeOverageSummaryFromArtifacts,
  computeWeeklyQuotaExhaustionFromArtifacts,
  WeeklyQuotaExhaustionBreakdown
} from '@/utils/ingestion/analytics';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';
import { UserSummary } from './types';
import { buildUserQuotaMapFromRows } from './quota';

// -----------------------------
// Legacy Constants & Scoring (preserved for tests)
// -----------------------------

interface SpecialFeatureConfig { readonly keyword: string; readonly score: number; readonly description: string; }
export const SPECIAL_FEATURES_CONFIG: readonly SpecialFeatureConfig[] = [
  { keyword: 'code review', score: 8, description: 'Code Review feature usage' },
  { keyword: 'coding agent', score: 8, description: 'Coding Agent feature usage' },
  { keyword: 'padawan', score: 8, description: 'Padawan feature usage' },
  { keyword: 'spark', score: 4, description: 'Spark feature usage' }
] as const;
export const MAX_SPECIAL_FEATURES_SCORE = 20;

export function calculateSpecialFeaturesScore(models: string[]): number {
  const modelSet = new Set(models.map(m => m.toLowerCase()));
  let totalScore = 0;
  const usedFeatureTypes = new Set<string>();
  const featureGroups = [
    { type: 'code_review', keywords: ['code review'], score: 8 },
    { type: 'coding_agent', keywords: ['coding agent', 'padawan'], score: 8 },
    { type: 'spark', keywords: ['spark'], score: 4 }
  ];
  for (const group of featureGroups) {
    const hasFeature = group.keywords.some(keyword => modelSet.has(keyword));
    if (hasFeature && !usedFeatureTypes.has(group.type)) {
      totalScore += group.score;
      usedFeatureTypes.add(group.type);
    }
  }
  return Math.min(totalScore, MAX_SPECIAL_FEATURES_SCORE);
}

// -----------------------------
// Shim Functions (legacy signatures delegating to artifact implementations)
// -----------------------------

export function computeWeeklyQuotaExhaustion(processedData: ProcessedData[]): WeeklyQuotaExhaustionBreakdown {
  if (processedData.length === 0) return { totalUsersExhausted: 0, weeks: [] };
  const quota = buildQuotaArtifactsFromProcessedData(processedData);
  const daily = buildDailyBucketsArtifactsFromProcessedData(processedData);
  return computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
}

export interface OverageSummary { totalOverageRequests: number; totalOverageCost: number; }
export function computeOverageSummary(userData: UserSummary[], processedData: ProcessedData[]): OverageSummary {
  const quotaMap = buildUserQuotaMapFromRows(processedData);
  let totalOverageRequests = 0;
  for (const u of userData) {
    const quotaVal = quotaMap.get(u.user) ?? 'unlimited';
    totalOverageRequests += calculateOverageRequests(u.totalRequests, quotaVal);
  }
  return { totalOverageRequests, totalOverageCost: calculateOverageCost(totalOverageRequests) };
}

// Convenience wrapper for tests migrating to artifact version directly
export function computeOverageSummaryArtifacts(processedData: ProcessedData[]): OverageSummary {
  const usage = buildUsageArtifactsFromProcessedData(processedData);
  const quota = buildQuotaArtifactsFromProcessedData(processedData);
  return computeOverageSummaryFromArtifacts(usage, quota);
}
