import type { NormalizedRow } from '@/utils/ingestion';

export function makeNormalizedRow(partial: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    date: partial.date ?? '2025-06-01T00:00:00Z',
    day: partial.day ?? '2025-06-01',
    user: partial.user ?? 'test-user-one',
    model: partial.model ?? 'mock-model',
    quantity: partial.quantity ?? 1,
    quotaRaw: partial.quotaRaw,
    quotaValue: partial.quotaValue,
    exceedsQuota: partial.exceedsQuota,
    product: partial.product,
    sku: partial.sku,
    organization: partial.organization,
    costCenter: partial.costCenter,
    appliedCostPerQuantity: partial.appliedCostPerQuantity,
    grossAmount: partial.grossAmount,
    discountAmount: partial.discountAmount,
    netAmount: partial.netAmount,
    aicQuantity: partial.aicQuantity,
    aicGrossAmount: partial.aicGrossAmount,
    isNonCopilotUsage: partial.isNonCopilotUsage ?? false,
    usageBucket: partial.usageBucket,
  };
}
