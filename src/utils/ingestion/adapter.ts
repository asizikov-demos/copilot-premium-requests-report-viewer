/**
 * Bridge adapter for backward compatibility.
 * Converts new aggregator outputs back to legacy ProcessedData[] format
 * while components are being migrated.
 */

import { CSVData, ProcessedData } from '@/types/csv';

import { buildProcessedDataFromRawRows } from './adapters';
import { QuotaArtifacts, UsageArtifacts } from './types';

/**
 * Temporary: reconstruct ProcessedData[] from raw CSV for components
 * that haven't been migrated to use aggregator outputs directly.
 */
export function buildProcessedDataLegacy(rawData: CSVData[]): ProcessedData[] {
  return buildProcessedDataFromRawRows(rawData as unknown as Record<string, unknown>[]);
}

/**
 * Enriches UserAggregate[] with quota values from QuotaArtifacts.
 * This combines outputs from UsageAggregator + QuotaAggregator.
 */
export function enrichUserAggregates(
  usageArtifacts: UsageArtifacts,
  quotaArtifacts: QuotaArtifacts
) {
  return usageArtifacts.users.map(user => ({
    ...user,
    quotaValue: quotaArtifacts.quotaByUser.get(user.user) ?? 'unlimited'
  }));
}
