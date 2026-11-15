import type { NormalizedRow } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';

export function makeNormalizedRow(partial: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    date: partial.date ?? partial.day ?? '2025-06-01T00:00:00Z',
    day: partial.day ?? '2025-06-01',
    user: partial.user ?? 'test-user-one',
    model: partial.model ?? 'test-model',
    quantity: partial.quantity ?? 1,
    quotaRaw: partial.quotaRaw,
    quotaValue: partial.quotaValue,
    product: partial.product,
    sku: partial.sku,
    unitType: partial.unitType,
    usageUnit: partial.usageUnit,
    billingQuantity: partial.billingQuantity,
    organization: partial.organization,
    costCenter: partial.costCenter,
    appliedCostPerQuantity: partial.appliedCostPerQuantity,
    grossAmount: partial.grossAmount,
    discountAmount: partial.discountAmount,
    netAmount: partial.netAmount,
    aicQuantity: partial.aicQuantity,
    aicGrossAmount: partial.aicGrossAmount,
    inputTokens: partial.inputTokens,
    outputTokens: partial.outputTokens,
    cacheReadTokens: partial.cacheReadTokens,
    cacheWriteTokens: partial.cacheWriteTokens,
    isUnattributedUsage: partial.isUnattributedUsage ?? false,
    usageBucket: partial.usageBucket,
  };
}

export function makeUsageRow(partial: Partial<NormalizedRow> = {}): NormalizedRow {
  return makeNormalizedRow({
    quantity: 0,
    quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
    quotaRaw: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
    unitType: 'ai-credits',
    usageUnit: 'ai_credit',
    ...partial,
  });
}
