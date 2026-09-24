/**
 * Row normalization utility.
 * Converts raw CSV row into standardized NormalizedRow for aggregators.
 */

import { parseQuotaValue } from '@/utils/analytics/quota';
import type { CSVData } from '@/types/csv';
import { getUsageUnitKind } from '@/utils/unitType';

import { normalizeDateToIso, type DateNormalizer } from './dateNormalization';
import { parseTokenCounts } from './tokenFields';
import {
  NormalizedRow,
  UNATTRIBUTED_AI_CREDIT_BUCKET,
} from './types';

/**
 * Normalize a raw CSV row object into a typed, validated structure.
 * Returns null if row is invalid or missing required fields.
 *
 * When `options.allowInvalidQuantity` is true, rows with a non-numeric quantity
 * are not rejected; instead the returned row will have `quantity` as `NaN`.
 * Callers using this option must handle NaN quantity values themselves.
 *
 * `options.normalizeDate` lets the streaming orchestrator inject a date parser
 * selected once from the first row. When omitted, each value is detected
 * individually via `normalizeDateToIso`.
 */
export function normalizeRow(
  raw: CSVData | Record<string, unknown>,
  warnings: string[],
  options: { allowInvalidQuantity?: boolean; normalizeDate?: DateNormalizer } = {}
): NormalizedRow | null {
  const rawRecord = raw as Record<string, unknown>;
  const {
    date,
    username,
    model,
    quantity,
    total_monthly_quota,
    product,
    sku,
    unit_type,
    organization,
    cost_center_name,
    applied_cost_per_quantity,
    gross_amount,
    discount_amount,
    net_amount,
  } = rawRecord;
  
  // Type guard and validate required fields
  if (typeof date !== 'string' || typeof username !== 'string' || typeof model !== 'string' || quantity == null) {
    return null;
  }

  // Normalize the date into ISO YYYY-MM-DD so downstream code can rely on it.
  const normalizeDate = options.normalizeDate ?? normalizeDateToIso;
  const isoDate = normalizeDate(date);
  if (isoDate === null) {
    warnings.push(`Unrecognized date format for user=${username} date=${date}`);
    return null;
  }

  const trimmedUsername = username.trim();
  const unitType = typeof unit_type === 'string' && unit_type.trim() !== '' ? unit_type.trim() : undefined;
  const skuValue = typeof sku === 'string' ? sku : undefined;
  const usageUnit = getUsageUnitKind(unitType, skuValue);
  if (usageUnit === 'unknown') {
    warnings.push(`Unsupported usage unit at date=${date}: expected AI Credits, received ${unitType ?? skuValue ?? 'no unit or SKU'}`);
    return null;
  }
  const isUnattributedUsage = trimmedUsername.length === 0;
  const usageBucket = isUnattributedUsage ? UNATTRIBUTED_AI_CREDIT_BUCKET : undefined;

  // Parse quantity
  const parsedQty = typeof quantity === 'number' ? quantity : parseFloat(String(quantity));
  if (Number.isNaN(parsedQty) && !options.allowInvalidQuantity) {
    warnings.push(`Invalid quantity for user=${username} date=${date}`);
    return null;
  }
  const qty = parsedQty;
  
  // Parse quota if present
  const quotaValue = isUnattributedUsage
    ? 0
    : total_monthly_quota && typeof total_monthly_quota === 'string'
      ? parseQuotaValue(total_monthly_quota)
      : undefined;
  
  // Parse billing numeric fields (ignore if unparsable)
  const parseNum = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isNaN(n) ? undefined : n;
  };
  const grossAmountValue = parseNum(gross_amount);

  return {
    date: isoDate,
    day: isoDate, // YYYY-MM-DD, UTC preserved (no timezone conversion)
    user: trimmedUsername,
    model,
    quantity: qty,
    billingQuantity: qty,
    quotaRaw: isUnattributedUsage
      ? '0'
      : typeof total_monthly_quota === 'string'
        ? total_monthly_quota
        : undefined,
    quotaValue,
    product: typeof product === 'string' ? product : undefined,
    sku: skuValue,
    unitType,
    usageUnit,
    organization: typeof organization === 'string' ? organization : undefined,
    costCenter: typeof cost_center_name === 'string' ? cost_center_name : undefined,
    appliedCostPerQuantity: parseNum(applied_cost_per_quantity),
    grossAmount: grossAmountValue,
    discountAmount: parseNum(discount_amount),
    netAmount: parseNum(net_amount),
    aicQuantity: qty,
    aicGrossAmount: grossAmountValue,
    isUnattributedUsage,
    usageBucket,
    ...parseTokenCounts(rawRecord, warnings),
  };
}
