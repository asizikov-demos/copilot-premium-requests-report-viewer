import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import {
  DailyBucketsAggregator, FeatureUsageAggregator, QuotaAggregator, UsageAggregator,
  buildNormalizedRowFromProcessedData, type Aggregator,
  type UsageArtifacts, type QuotaArtifacts, type DailyBucketsArtifacts, type FeatureUsageArtifacts,
} from '@/utils/ingestion';

function aggregate<T>(aggregator: Aggregator<T>, rows: ProcessedData[]): T {
  const ctx = { pricing: PRICING };
  aggregator.init?.(ctx);
  for (const row of rows) aggregator.onRow(buildNormalizedRowFromProcessedData(row), ctx);
  return aggregator.finalize(ctx);
}

export const buildUsageArtifactsFromProcessedData = (rows: ProcessedData[]): UsageArtifacts => aggregate(new UsageAggregator(), rows);
export const buildQuotaArtifactsFromProcessedData = (rows: ProcessedData[]): QuotaArtifacts => aggregate(new QuotaAggregator(), rows);
export const buildDailyBucketsArtifactsFromProcessedData = (rows: ProcessedData[]): DailyBucketsArtifacts => aggregate(new DailyBucketsAggregator(), rows);
export const buildFeatureUsageArtifactsFromProcessedData = (rows: ProcessedData[]): FeatureUsageArtifacts => aggregate(new FeatureUsageAggregator(), rows);
