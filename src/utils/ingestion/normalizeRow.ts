/**
 * Row normalization utility.
 * Converts raw CSV row into standardized NormalizedRow for aggregators.
 */

import { parseQuotaValue } from '@/utils/analytics/quota';
import { NormalizedRow } from './types';

/**
 * Normalize a raw CSV row object into a typed, validated structure.
 * Returns null if row is invalid or missing required fields.
 */
export function normalizeRow(raw: Record<string, unknown>, warnings: string[]): NormalizedRow | null {
  const {
    date,
    username,
    model,
    quantity,
    total_monthly_quota,
    exceeds_quota,
    product,
    sku,
    organization,
    cost_center_name,
    applied_cost_per_quantity,
    gross_amount,
    discount_amount,
    net_amount
  } = raw as Record<string, unknown>;
  
  // Type guard and validate required fields
  if (typeof date !== 'string' || typeof username !== 'string' || typeof model !== 'string' || quantity == null) {
    return null;
  }
  
  // Parse quantity
  const qty = typeof quantity === 'number' ? quantity : parseFloat(String(quantity));
  if (Number.isNaN(qty)) {
    warnings.push(`Invalid quantity for user=${username} date=${date}`);
    return null;
  }
  
  // Parse quota if present
  const quotaValue = total_monthly_quota && typeof total_monthly_quota === 'string' 
    ? parseQuotaValue(total_monthly_quota) 
    : undefined;
  
  // Parse exceeds quota flag
  const exceedsQuota = exceeds_quota === 'true' || exceeds_quota === true;
  
  // Parse billing numeric fields (ignore if unparsable)
  const parseNum = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isNaN(n) ? undefined : n;
  };

  return {
    date,
    day: date.substring(0, 10), // Extract YYYY-MM-DD, preserving UTC
    user: username,
    model,
    quantity: qty,
    quotaRaw: typeof total_monthly_quota === 'string' ? total_monthly_quota : undefined,
    quotaValue,
    exceedsQuota,
    product: typeof product === 'string' ? product : undefined,
    sku: typeof sku === 'string' ? sku : undefined,
    organization: typeof organization === 'string' ? organization : undefined,
    costCenter: typeof cost_center_name === 'string' ? cost_center_name : undefined,
    appliedCostPerQuantity: parseNum(applied_cost_per_quantity),
    grossAmount: parseNum(gross_amount),
    discountAmount: parseNum(discount_amount),
    netAmount: parseNum(net_amount)
  };
}
