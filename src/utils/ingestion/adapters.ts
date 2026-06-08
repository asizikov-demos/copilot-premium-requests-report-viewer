/**
 * Adapter utilities to bridge the ingestion pipeline with existing analysis code.
 */

import type { CSVData, ProcessedData } from '@/types/csv';

import { buildDateKeys } from '../dateKeys';
import { normalizeDateToIso } from './dateNormalization';
import { normalizeRow } from './normalizeRow';
import {
  NormalizedRow,
  IngestionResult,
  QuotaArtifacts,
  UsageArtifacts,
  DailyBucketsArtifacts,
} from './types';

function buildTimestampFromRowDate(row: NormalizedRow, warnings: string[]): Date | null {
  const isoDate = normalizeDateToIso(row.day) ?? normalizeDateToIso(row.date);
  if (isoDate === null) {
    warnings.push(`Unrecognized date format for user=${row.user} date=${row.date}`);
    return null;
  }

  return new Date(`${isoDate}T00:00:00Z`);
}

/**
 * Reconstructs a ProcessedData array from normalized rows.
 * Used by hooks that haven't been migrated to aggregator outputs yet.
 */
export function buildProcessedDataFromRows(
  rows: NormalizedRow[] | undefined | null,
  warnings: string[] = []
): ProcessedData[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const processed: ProcessedData[] = [];
  for (const row of rows) {
    const timestamp = buildTimestampFromRowDate(row, warnings);
    if (timestamp === null) continue;

    const keys = buildDateKeys(timestamp);
    processed.push({
      timestamp,
      user: row.user,
      model: row.model,
      requestsUsed: row.quantity,
      exceedsQuota: row.exceedsQuota ?? false,
      totalQuota: row.quotaValue === 'unknown'
        ? 'Unknown'
        : (row.quotaRaw || String(row.quotaValue ?? 'Unknown')),
      quotaValue: row.quotaValue ?? 'unknown',
      product: row.product,
      sku: row.sku,
      unitType: row.unitType,
      usageUnit: row.usageUnit,
      billingQuantity: row.billingQuantity,
      organization: row.organization,
      costCenter: row.costCenter,
      appliedCostPerQuantity: row.appliedCostPerQuantity,
      grossAmount: row.grossAmount,
      discountAmount: row.discountAmount,
      netAmount: row.netAmount,
      aicQuantity: row.aicQuantity,
      aicGrossAmount: row.aicGrossAmount,
      isNonCopilotUsage: row.isNonCopilotUsage,
      usageBucket: row.usageBucket,
      ...keys
    });
  }
  return processed;
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

  return buildProcessedDataFromRows(normalizedRows, warnings);
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
