import type { ProcessedData } from '@/types/csv';
import {
  buildDailyBucketsArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  computeWeeklyQuotaExhaustionFromArtifacts,
} from '@/utils/ingestion/analytics';
import type { WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';

export type { WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';

export function computeWeeklyQuotaExhaustion(data: ProcessedData[]): WeeklyQuotaExhaustionBreakdown {
  if (data.length === 0) return { totalUsersExhausted: 0, weeks: [] };
  const quota = buildQuotaArtifactsFromProcessedData(data);
  const daily = buildDailyBucketsArtifactsFromProcessedData(data);
  return computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
}
