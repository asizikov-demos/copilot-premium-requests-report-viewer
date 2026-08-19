export type UsageUnitKind = 'request' | 'ai_credit' | 'unknown';

function normalizeUsageValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function isRequestUnitType(unitType: string | undefined): boolean {
  const normalizedUnitType = normalizeUsageValue(unitType);
  return normalizedUnitType === '' || normalizedUnitType === 'requests';
}

export function isAiCreditUnitType(unitType: string | undefined): boolean {
  const normalizedUnitType = normalizeUsageValue(unitType);
  return normalizedUnitType === 'ai-credit' || normalizedUnitType === 'ai-credits';
}

export function isAiCreditSku(sku: string | undefined): boolean {
  const normalizedSku = normalizeUsageValue(sku);
  return normalizedSku === 'copilot_ai_credit' || normalizedSku === 'code_quality_ai_credit';
}

export function getUsageUnitKind(unitType: string | undefined, sku?: string): UsageUnitKind {
  if (isAiCreditUnitType(unitType) || isAiCreditSku(sku)) {
    return 'ai_credit';
  }

  if (isRequestUnitType(unitType)) {
    return 'request';
  }

  return 'unknown';
}

export function isSupportedUsageUnitType(unitType: string | undefined, sku?: string): boolean {
  return getUsageUnitKind(unitType, sku) !== 'unknown';
}

export function isUsageBasedBillingRow(row: {
  usageUnit?: UsageUnitKind;
  product?: string;
  sku?: string;
}): boolean {
  if (row.usageUnit !== 'ai_credit') {
    return false;
  }

  return normalizeUsageValue(row.product) !== 'code_quality'
    && normalizeUsageValue(row.sku) !== 'code_quality_ai_credit';
}
