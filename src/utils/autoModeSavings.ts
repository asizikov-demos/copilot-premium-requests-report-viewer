import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';

const AUTO_MODE_MODEL_PREFIX = /^auto:\s*/i;
const AUTO_MODE_PRU_MULTIPLIER = 1 - PRICING.AUTO_MODE_DISCOUNT_RATE;

export interface AutoModeSavingsRow {
  model: string;
  requests: number;
  grossCost: number;
  savings: number;
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

    if (!model) {
      continue;
    }

    const appliedCostPerRequest = row.appliedCostPerQuantity ?? PRICING.OVERAGE_RATE_PER_REQUEST;
    const requests = row.requestsUsed / AUTO_MODE_PRU_MULTIPLIER;
    const grossCost = requests * appliedCostPerRequest;
    const savings = grossCost * PRICING.AUTO_MODE_DISCOUNT_RATE;
    const bucket = buckets.get(model) ?? {
      model,
      requests: 0,
      grossCost: 0,
      savings: 0,
    };

    bucket.requests += requests;
    bucket.grossCost += grossCost;
    bucket.savings += savings;
    buckets.set(model, bucket);
  }

  return Array.from(buckets.values()).sort((left, right) => right.savings - left.savings);
}
