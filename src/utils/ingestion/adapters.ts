/**
 * Adapter utilities to bridge the ingestion pipeline with existing analysis code.
 */

import type { CSVData, ProcessedData } from '@/types/csv';

import { buildDateKeys } from '../dateKeys';
import { normalizeRow } from './normalizeRow';
import {
  NormalizedRow,
  IngestionResult,
  QuotaArtifacts,
  UsageArtifacts,
  DailyBucketsArtifacts,
} from './types';

/**
 * Reconstructs a ProcessedData array from normalized rows.
 * Used by hooks that haven't been migrated to aggregator outputs yet.
 */
export function buildProcessedDataFromRows(rows: NormalizedRow[] | undefined | null): ProcessedData[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  return rows.map(row => {
    const timestamp = new Date(`${row.date.substring(0, 10)}T00:00:00Z`);
    const keys = buildDateKeys(timestamp);
    return {
      timestamp,
      user: row.user,
      model: row.model,
      requestsUsed: row.quantity,
      exceedsQuota: row.exceedsQuota ?? false,
      totalQuota: row.quotaRaw || (row.quotaValue === 'unlimited' ? 'Unlimited' : String(row.quotaValue ?? 'Unlimited')),
      quotaValue: row.quotaValue ?? 'unlimited',
      product: row.product,
      sku: row.sku,
      organization: row.organization,
      costCenter: row.costCenter,
      appliedCostPerQuantity: row.appliedCostPerQuantity,
      grossAmount: row.grossAmount,
      discountAmount: row.discountAmount,
      netAmount: row.netAmount,
      isNonCopilotUsage: row.isNonCopilotUsage,
      usageBucket: row.usageBucket,
      ...keys
    };
  });
}

export function buildProcessedDataFromRawRows(
  rows: readonly (CSVData | Record<string, unknown>)[] | undefined | null
): ProcessedData[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const warnings: string[] = [];
  const normalizedRows = rows
    .map(row => normalizeRow(row, warnings, { allowInvalidQuantity: true }))
    .filter((row): row is NormalizedRow => row !== null);

  return buildProcessedDataFromRows(normalizedRows);
}

/**
 * Stores normalized rows during ingestion for later reconstruction.
 */
export class RawDataCollector {
  private rows: NormalizedRow[] = [];
  
  collect(row: NormalizedRow): void {
    this.rows.push(row);
  }
  
  getRows(): NormalizedRow[] {
    return this.rows;
  }
  
  clear(): void {
    this.rows = [];
  }
}

/**
 * Extended ingestion result that includes raw rows for adapter.
 */
export interface ExtendedIngestionResult extends IngestionResult {
  rawRows: NormalizedRow[];
}

/**
 * Helper to extract typed aggregator outputs.
 */
export function extractAggregatorOutputs(result: IngestionResult) {
  return {
    quotaArtifacts: result.outputs.quota as QuotaArtifacts,
    usageArtifacts: result.outputs.usage as UsageArtifacts,
    dailyBucketsArtifacts: result.outputs.dailyBuckets as DailyBucketsArtifacts
  };
}
