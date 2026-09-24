export type UsageUnitKind = 'ai_credit' | 'unknown';

function normalizeUsageValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function isAiCreditUnitType(unitType: string | undefined): boolean {
  const normalizedUnitType = normalizeUsageValue(unitType);
  return normalizedUnitType === 'ai-credit' || normalizedUnitType === 'ai-credits';
}

export function isAiCreditSku(sku: string | undefined): boolean {
  return normalizeUsageValue(sku).endsWith('_ai_credit');
}

export function isLegacyRequestRow(unitType: string | undefined, sku?: string): boolean {
  return normalizeUsageValue(unitType) === 'requests'
    || normalizeUsageValue(sku).endsWith('_premium_request');
}

export function getUsageUnitKind(unitType: string | undefined, sku?: string): UsageUnitKind {
  if (isLegacyRequestRow(unitType, sku)) {
    return 'unknown';
  }
  if (isAiCreditUnitType(unitType) || (!normalizeUsageValue(unitType) && isAiCreditSku(sku))) {
    return 'ai_credit';
  }

  return 'unknown';
}

export function isSupportedUsageUnitType(unitType: string | undefined, sku?: string): boolean {
  return getUsageUnitKind(unitType, sku) !== 'unknown';
}
