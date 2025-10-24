/**
 * Adapter utilities to bridge the ingestion pipeline with existing analysis code.
 */

import { ProcessedData } from '@/types/csv';
import { NormalizedRow, IngestionResult, QuotaArtifacts, UsageArtifacts, DailyBucketsArtifacts } from './types';
import { buildDateKeys } from '../dateKeys';

/**
 * Reconstructs a ProcessedData array from normalized rows.
 * Used by hooks that haven't been migrated to aggregator outputs yet.
 */
interface ExpandedCSVLike {
  date: string;
  username: string;
  model: string;
  quantity: string | number;
  exceeds_quota?: string;
  total_monthly_quota?: string;
  applied_cost_per_quantity?: string;
  gross_amount?: string;
  discount_amount?: string;
  net_amount?: string;
  product?: string;
  sku?: string;
  organization?: string;
  cost_center_name?: string;
}

function isExpandedCSVLike(r: unknown): r is ExpandedCSVLike {
  return !!r && typeof r === 'object' && 'username' in r && 'quantity' in r && 'date' in r;
}

/**
 * Build ProcessedData from either NormalizedRow objects (preferred path) or
 * raw expanded CSV row objects used by older tests. This maintains backward
 * compatibility during migration without resorting to 'any'.
 */
export function buildProcessedDataFromRows(rows: unknown[] | undefined | null): ProcessedData[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  return rows.map(raw => {
    if (isExpandedCSVLike(raw)) {
      const quantityNum = typeof raw.quantity === 'number' ? raw.quantity : parseFloat(raw.quantity);
      const timestamp = new Date(`${raw.date}T00:00:00Z`);
      const keys = buildDateKeys(timestamp);
      const quotaRaw = raw.total_monthly_quota || 'Unlimited';
      const quotaValue = quotaRaw.toLowerCase() === 'unlimited' ? 'unlimited' : parseFloat(quotaRaw);
      return {
        timestamp,
        user: raw.username,
        model: raw.model,
        requestsUsed: quantityNum,
        exceedsQuota: raw.exceeds_quota ? raw.exceeds_quota.toLowerCase() === 'true' : false,
        totalQuota: quotaRaw,
        quotaValue,
        product: raw.product,
        sku: raw.sku,
        organization: raw.organization,
        costCenter: raw.cost_center_name,
        appliedCostPerQuantity: raw.applied_cost_per_quantity ? parseFloat(raw.applied_cost_per_quantity) : undefined,
        grossAmount: raw.gross_amount ? parseFloat(raw.gross_amount) : undefined,
        discountAmount: raw.discount_amount ? parseFloat(raw.discount_amount) : undefined,
        netAmount: raw.net_amount ? parseFloat(raw.net_amount) : undefined,
        ...keys
      };
    }
    const row = raw as NormalizedRow; // Fallback to assumed NormalizedRow shape
    const timestamp = new Date(`${row.date}T00:00:00Z`);
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
