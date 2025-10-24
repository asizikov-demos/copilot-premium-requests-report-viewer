/**
 * Bridge adapter for backward compatibility.
 * Converts new aggregator outputs back to legacy ProcessedData[] format
 * while components are being migrated.
 */

import { CSVData, ProcessedData } from '@/types/csv';
import { buildDateKeys } from '../dateKeys';
import { parseQuotaValue } from '../analytics/quota';
import { QuotaArtifacts, UsageArtifacts } from './types';

/**
 * Temporary: reconstruct ProcessedData[] from raw CSV for components
 * that haven't been migrated to use aggregator outputs directly.
 * 
 * TODO: Remove once all components use aggregator artifacts.
 */
export function buildProcessedDataLegacy(rawData: CSVData[]): ProcessedData[] {
  return rawData.map(row => {
    const timestamp = new Date(`${row.date}T00:00:00Z`);
    const keys = buildDateKeys(timestamp);
    const totalQuotaRaw = row.total_monthly_quota || 'Unlimited';
    
    return {
      timestamp,
      user: row.username,
      model: row.model,
      requestsUsed: parseFloat(row.quantity),
      exceedsQuota: row.exceeds_quota ? row.exceeds_quota.toLowerCase() === 'true' : false,
      totalQuota: totalQuotaRaw,
      quotaValue: parseQuotaValue(totalQuotaRaw),
      product: row.product,
      sku: row.sku,
      organization: row.organization,
      costCenter: row.cost_center_name,
      appliedCostPerQuantity: row.applied_cost_per_quantity ? parseFloat(row.applied_cost_per_quantity) : undefined,
      grossAmount: row.gross_amount ? parseFloat(row.gross_amount) : undefined,
      discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : undefined,
      netAmount: row.net_amount ? parseFloat(row.net_amount) : undefined,
      ...keys
    };
  });
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
