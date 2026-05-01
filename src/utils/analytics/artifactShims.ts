import { ProcessedData } from '@/types/csv';
import {
  buildDailyBucketsArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  buildUsageArtifactsFromProcessedData,
  computeOverageSummaryFromArtifacts,
  computeWeeklyQuotaExhaustionFromArtifacts,
  WeeklyQuotaExhaustionBreakdown
} from '@/utils/ingestion/analytics';

import type { OverageSummary } from './overage';

export { computeOverageSummary } from './overage';
export type { OverageSummary } from './overage';

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

// Convenience wrapper for tests migrating to artifact version directly
export function computeOverageSummaryArtifacts(processedData: ProcessedData[]): OverageSummary {
  const usage = buildUsageArtifactsFromProcessedData(processedData);
  const quota = buildQuotaArtifactsFromProcessedData(processedData);
  return computeOverageSummaryFromArtifacts(usage, quota);
}
