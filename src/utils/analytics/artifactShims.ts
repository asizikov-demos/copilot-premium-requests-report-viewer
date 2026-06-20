import { ProcessedData } from '@/types/csv';
import {
  buildDailyBucketsArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  computeWeeklyQuotaExhaustionFromArtifacts,
  WeeklyQuotaExhaustionBreakdown
} from '@/utils/ingestion/analytics';
import { isCodeReviewModel, isCodingAgentModel, isSparkProduct } from '@/utils/productClassification';

const CODE_REVIEW_SPECIAL_FEATURE_SCORE = 8;
const CODING_AGENT_SPECIAL_FEATURE_SCORE = 8;
const SPARK_SPECIAL_FEATURE_SCORE = 4;
export const MAX_SPECIAL_FEATURES_SCORE = 20;

export function calculateSpecialFeaturesScore(models: string[]): number {
  let totalScore = 0;

  if (models.some(isCodeReviewModel)) {
    totalScore += CODE_REVIEW_SPECIAL_FEATURE_SCORE;
  }

  if (models.some(isCodingAgentModel)) {
    totalScore += CODING_AGENT_SPECIAL_FEATURE_SCORE;
  }

  if (models.some(model => isSparkProduct(model))) {
    totalScore += SPARK_SPECIAL_FEATURE_SCORE;
  }

  return Math.min(totalScore, MAX_SPECIAL_FEATURES_SCORE);
}

export function computeWeeklyQuotaExhaustion(processedData: ProcessedData[]): WeeklyQuotaExhaustionBreakdown {
  if (processedData.length === 0) return { totalUsersExhausted: 0, weeks: [] };
  const quota = buildQuotaArtifactsFromProcessedData(processedData);
  const daily = buildDailyBucketsArtifactsFromProcessedData(processedData);
  return computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
}
