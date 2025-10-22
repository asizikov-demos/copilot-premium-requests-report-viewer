/**
 * Adapter utilities to bridge new ingestion pipeline with existing analysis code.
 * These adapters reconstruct ProcessedData structures needed by current hooks/components.
 * As components migrate to use aggregator outputs directly, these can be removed.
 */

import { ProcessedData } from '@/types/csv';
import { NormalizedRow, IngestionResult, QuotaArtifacts, UsageArtifacts, DailyBucketsArtifacts } from './types';
import { buildDateKeys } from '../dateKeys';

/**
 * Reconstructs a ProcessedData array from normalized rows.
 * Used by hooks that haven't been migrated to aggregator outputs yet.
 */
export function buildProcessedDataFromRows(rows: NormalizedRow[]): ProcessedData[] {
  return rows.map(row => {
    // Allow legacy/raw CSV rows in tests (defensive). If 'username' exists we treat it as raw CSVData.
    const asAny = row as any;
    const date = (row as any).date;
    const user = typeof asAny.user === 'string' ? asAny.user : asAny.username;
    const model = row.model || asAny.model;
    const quantity = typeof (row as any).quantity === 'number' ? (row as any).quantity : parseFloat(String(asAny.quantity));
    const timestamp = new Date(`${date}T00:00:00Z`);
    const keys = buildDateKeys(timestamp);
    
    return {
      timestamp,
      user,
      model,
      requestsUsed: quantity,
      exceedsQuota: (row as any).exceedsQuota ?? (typeof asAny.exceeds_quota === 'string' ? asAny.exceeds_quota.toLowerCase() === 'true' : false),
      totalQuota: row.quotaRaw || asAny.total_monthly_quota || 'Unlimited',
      quotaValue: row.quotaValue || (asAny.total_monthly_quota ? asAny.total_monthly_quota : 'unlimited'),
      product: row.product || asAny.product,
      sku: row.sku || asAny.sku,
      organization: row.organization || asAny.organization,
      costCenter: row.costCenter || asAny.cost_center_name,
      appliedCostPerQuantity: row.appliedCostPerQuantity ?? (asAny.applied_cost_per_quantity ? parseFloat(String(asAny.applied_cost_per_quantity)) : undefined),
      grossAmount: row.grossAmount ?? (asAny.gross_amount ? parseFloat(String(asAny.gross_amount)) : undefined),
      discountAmount: row.discountAmount ?? (asAny.discount_amount ? parseFloat(String(asAny.discount_amount)) : undefined),
      netAmount: row.netAmount ?? (asAny.net_amount ? parseFloat(String(asAny.net_amount)) : undefined),
      ...keys
    };
  });
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
