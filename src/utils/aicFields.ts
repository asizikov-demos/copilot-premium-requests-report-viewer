import { PRICING } from '@/constants/pricing';

interface AicFields {
  aicQuantity?: number;
  aicGrossAmount?: number;
}

export function getEffectiveAicQuantity(row: AicFields): number {
  const quantity = typeof row.aicQuantity === 'number' ? row.aicQuantity : 0;
  const quantityDerivedFromGross = typeof row.aicGrossAmount === 'number'
    ? row.aicGrossAmount / PRICING.AI_CREDIT_USD_VALUE
    : 0;

  return Math.max(quantity, quantityDerivedFromGross);
}

export function hasAicFields(rows: Iterable<AicFields>): boolean {
  for (const row of rows) {
    if (row.aicGrossAmount !== undefined) {
      return true;
    }
  }

  return false;
}
