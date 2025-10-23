/**
 * Ingestion module exports.
 * Provides composable streaming CSV ingestion with pluggable aggregators.
 */

export * from './types';
export * from './normalizeRow';
export * from './orchestrator';
export * from './QuotaAggregator';
export * from './UsageAggregator';
export * from './DailyBucketsAggregator';
export * from './BillingAggregator';
export * from './FeatureUsageAggregator';
export * from './adapters';
export * from './analytics';

// Re-export helpers
import { QuotaArtifacts } from './types';

/**
 * Helper to get user quota from aggregator artifacts (O(1) lookup).
 * Replaces the old O(R) getUserQuotaValue function.
 */
export function getUserQuota(quotaArtifacts: QuotaArtifacts, user: string): number | 'unlimited' {
  return quotaArtifacts.quotaByUser.get(user) ?? 'unlimited';
}
