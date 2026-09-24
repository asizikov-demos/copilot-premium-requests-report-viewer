import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';

const AUTO_MODE_MODEL_PREFIX = /^auto:\s*/i;
const COST_BEFORE_AUTO_MULTIPLIER = 1 / (1 - PRICING.AUTO_MODE_DISCOUNT_RATE);

export interface AutoModeSavingsRow {
  model: string;
  quantity: number;
  costBeforeAuto: number;
  savings: number;
}

function getBilledQuantity(row: ProcessedData): number {
  return row.billingQuantity ?? row.creditsUsed;
}

export function getAutoModeBaseModel(model: string): string | null {
  if (!AUTO_MODE_MODEL_PREFIX.test(model)) {
    return null;
  }

  const baseModel = model.replace(AUTO_MODE_MODEL_PREFIX, '').trim();
  return baseModel.length > 0 ? baseModel : null;
}

export function aggregateAutoModeSavings(rows: ProcessedData[]): AutoModeSavingsRow[] {
  const buckets = new Map<string, AutoModeSavingsRow>();

  for (const row of rows) {
    const model = getAutoModeBaseModel(row.model);

    if (!model || row.grossAmount === undefined) {
      continue;
    }

    const billedQuantity = getBilledQuantity(row);
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

  return Array.from(buckets.values()).sort((left, right) => right.savings - left.savings);
}
