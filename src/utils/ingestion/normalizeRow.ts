/**
 * Row normalization utility.
 * Converts raw CSV row into standardized NormalizedRow for aggregators.
 */

import { parseQuotaValue } from '@/utils/analytics/quota';
import type { CSVData } from '@/types/csv';
import { isCodeReviewModel } from '@/utils/productClassification';
import { isRequestUnitType } from '@/utils/unitType';

import {
  NON_COPILOT_CODE_REVIEW_BUCKET,
  NormalizedRow,
} from './types';

/**
 * Normalize a raw CSV row object into a typed, validated structure.
 * Returns null if row is invalid or missing required fields.
 *
 * When `options.allowInvalidQuantity` is true, rows with a non-numeric quantity
 * are not rejected; instead the returned row will have `quantity` as `NaN`.
 * Callers using this option must handle NaN quantity values themselves.
 */
export function normalizeRow(
  raw: CSVData | Record<string, unknown>,
  warnings: string[],
  options: { allowInvalidQuantity?: boolean } = {}
): NormalizedRow | null {
  const rawRecord = raw as Record<string, unknown>;
  const {
    date,
    username,
    model,
    quantity,
    total_monthly_quota,
    exceeds_quota,
    product,
    sku,
    unit_type,
    organization,
    cost_center_name,
    applied_cost_per_quantity,
    gross_amount,
    discount_amount,
    net_amount,
    aic_quantity,
    aic_gross_amount
  } = rawRecord;
  
  // Type guard and validate required fields
  if (typeof date !== 'string' || typeof username !== 'string' || typeof model !== 'string' || quantity == null) {
    return null;
  }

  const trimmedUsername = username.trim();
  const isNonCopilotCodeReviewUsage = trimmedUsername.length === 0 && isCodeReviewModel(model);

  if (trimmedUsername.length === 0 && !isNonCopilotCodeReviewUsage) {
    warnings.push(`Blank username is only allowed for Code Review usage date=${date}`);
    return null;
  }
  
  const unitType = typeof unit_type === 'string' ? unit_type.trim() : undefined;
  const shouldUseRequestValues = isRequestUnitType(unitType);

  // Parse quantity
  const parsedQty = typeof quantity === 'number' ? quantity : parseFloat(String(quantity));
  if (shouldUseRequestValues && Number.isNaN(parsedQty) && !options.allowInvalidQuantity) {
    warnings.push(`Invalid quantity for user=${username} date=${date}`);
    return null;
  }
  const qty = shouldUseRequestValues ? parsedQty : 0;
  
  // Parse quota if present
  const quotaValue = isNonCopilotCodeReviewUsage
    ? 0
    : shouldUseRequestValues && total_monthly_quota && typeof total_monthly_quota === 'string'
      ? parseQuotaValue(total_monthly_quota)
      : undefined;
  
  // Parse exceeds quota flag
  const exceedsQuota = typeof exceeds_quota === 'string'
    ? exceeds_quota.toLowerCase() === 'true'
    : exceeds_quota === true;
  
  // Parse billing numeric fields (ignore if unparsable)
  const parseNum = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isNaN(n) ? undefined : n;
  };
  const parseRequestBillingAmount = (fieldName: string, v: unknown): number | undefined => {
    if (shouldUseRequestValues) {
      return parseNum(v);
    }
    return Object.prototype.hasOwnProperty.call(rawRecord, fieldName) ? 0 : undefined;
  };

  return {
    date,
    day: date.substring(0, 10), // Extract YYYY-MM-DD, preserving UTC
    user: trimmedUsername,
    model,
    quantity: qty,
    quotaRaw: isNonCopilotCodeReviewUsage
      ? '0'
      : shouldUseRequestValues && typeof total_monthly_quota === 'string'
        ? total_monthly_quota
        : undefined,
    quotaValue,
    exceedsQuota,
    product: typeof product === 'string' ? product : undefined,
    sku: typeof sku === 'string' ? sku : undefined,
    unitType,
    organization: typeof organization === 'string' ? organization : undefined,
    costCenter: typeof cost_center_name === 'string' ? cost_center_name : undefined,
    appliedCostPerQuantity: parseNum(applied_cost_per_quantity),
    grossAmount: parseRequestBillingAmount('gross_amount', gross_amount),
    discountAmount: parseRequestBillingAmount('discount_amount', discount_amount),
    netAmount: parseRequestBillingAmount('net_amount', net_amount),
    aicQuantity: parseNum(aic_quantity),
    aicGrossAmount: parseNum(aic_gross_amount),
    isNonCopilotUsage: isNonCopilotCodeReviewUsage,
    usageBucket: isNonCopilotCodeReviewUsage ? NON_COPILOT_CODE_REVIEW_BUCKET : undefined,
  };
}
