import {
  BillingAggregator, DailyBucketsAggregator, FeatureUsageAggregator, QuotaAggregator,
  TokenAggregator, UsageAggregator, deriveAnalysisFromArtifacts, type NormalizedRow,
} from '@/utils/ingestion';

import { aggregateRows } from './aggregateRows';

export const buildUsageArtifactsFromRows = (rows: NormalizedRow[]) => aggregateRows(new UsageAggregator(), rows);
export const buildQuotaArtifactsFromRows = (rows: NormalizedRow[]) => aggregateRows(new QuotaAggregator(), rows);
export const buildDailyBucketsArtifactsFromRows = (rows: NormalizedRow[]) => aggregateRows(new DailyBucketsAggregator(), rows);
export const buildFeatureUsageArtifactsFromRows = (rows: NormalizedRow[]) => aggregateRows(new FeatureUsageAggregator(), rows);
export const buildBillingArtifactsFromRows = (rows: NormalizedRow[]) => aggregateRows(new BillingAggregator(), rows);
export const buildTokenArtifactsFromRows = (rows: NormalizedRow[]) => aggregateRows(new TokenAggregator(), rows);

export function analyzeRows(rows: NormalizedRow[]) {
  return deriveAnalysisFromArtifacts(
    buildUsageArtifactsFromRows(rows), buildQuotaArtifactsFromRows(rows), buildDailyBucketsArtifactsFromRows(rows),
  );
}
