import { PRICING } from '@/constants/pricing';
import type { NormalizedRow } from '@/utils/ingestion/types';

const AUTO_MODE_MODEL_PREFIX = /^auto:\s*/i;
const COST_BEFORE_AUTO_MULTIPLIER = 1 / (1 - PRICING.AUTO_MODE_DISCOUNT_RATE);

export interface AutoModeSavingsRow {
  model: string;
  quantity: number;
  costBeforeAuto: number;
  savings: number;
}

export function getAutoModeBaseModel(model: string): string | null {
  if (!AUTO_MODE_MODEL_PREFIX.test(model)) {
    return null;
  }

  const baseModel = model.replace(AUTO_MODE_MODEL_PREFIX, '').trim();
  return baseModel.length > 0 ? baseModel : null;
}

export function accumulateAutoModeSavings(
  buckets: Map<string, AutoModeSavingsRow>,
  row: NormalizedRow
): void {
  const model = getAutoModeBaseModel(row.model);

  if (!model || row.grossAmount === undefined) {
    return;
  }

  const billedQuantity = row.billingQuantity ?? row.quantity;
  const billedGrossAmount = row.grossAmount;
  const costBeforeAuto = billedGrossAmount * COST_BEFORE_AUTO_MULTIPLIER;
  const savings = costBeforeAuto - billedGrossAmount;
  const bucket = buckets.get(model) ?? {
    model,
    quantity: 0,
    costBeforeAuto: 0,
    savings: 0,
  };

  bucket.quantity += billedQuantity;
  bucket.costBeforeAuto += costBeforeAuto;
  bucket.savings += savings;
  buckets.set(model, bucket);
}

export function aggregateAutoModeSavings(buckets: Map<string, AutoModeSavingsRow>): AutoModeSavingsRow[] {
  return Array.from(buckets.values()).sort((left, right) => right.savings - left.savings);
}
