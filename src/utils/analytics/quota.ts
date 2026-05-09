import { PRICING } from '@/constants/pricing';
import { ProcessedData } from '@/types/csv';
import { isRequestUnitType } from '@/utils/unitType';

export interface QuotaBreakdownResult {
  unknown: string[];
  business: string[];
  enterprise: string[];
  mixed: boolean;
  suggestedPlan: 'business' | 'enterprise' | null;
}

// Parse quota value from string
export function parseQuotaValue(quotaString: string): number | 'unknown' {
  const trimmed = quotaString.trim().toLowerCase();
  if (trimmed === 'unknown') {
    return 'unknown';
  }
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? 'unknown' : parsed;
}

/**
 * Build per-user quotas from processed rows using the canonical policy:
 * numeric quotas win over unknown values, and the highest numeric quota wins.
 */
export function buildUserQuotaMapFromRows(data: ProcessedData[]): Map<string, number | 'unknown'> {
  const userQuotas = new Map<string, number | 'unknown'>();

  for (const row of data) {
    if (row.isNonCopilotUsage || !isRequestUnitType(row.unitType)) {
      continue;
    }

    const existing = userQuotas.get(row.user);
    const current = row.quotaValue;

    if (
      existing === undefined
      || (existing === 'unknown' && typeof current === 'number')
      || (typeof current === 'number' && typeof existing === 'number' && current > existing)
    ) {
      userQuotas.set(row.user, current);
    }
  }

  return userQuotas;
}

export function buildQuotaBreakdown(data: ProcessedData[]): QuotaBreakdownResult {
  const userQuotas = buildUserQuotaMapFromRows(data);

  const unknown: string[] = [];
  const business: string[] = [];
  const enterprise: string[] = [];

  for (const [user, quota] of userQuotas) {
    if (quota === 'unknown') {
      unknown.push(user);
    } else if (quota === PRICING.BUSINESS_QUOTA) {
      business.push(user);
    } else if (quota === PRICING.ENTERPRISE_QUOTA) {
      enterprise.push(user);
    }
  }

  const quotaTypes = [
    unknown.length > 0 ? 'unknown' : null,
    business.length > 0 ? 'business' : null,
    enterprise.length > 0 ? 'enterprise' : null
  ].filter(Boolean);

  const mixed = quotaTypes.length > 1;
  let suggestedPlan: 'business' | 'enterprise' | null = null;
  if (!mixed && unknown.length === 0) {
    if (business.length > 0 && enterprise.length === 0) {
      suggestedPlan = 'business';
    } else if (enterprise.length > 0 && business.length === 0) {
      suggestedPlan = 'enterprise';
    }
  }

  return { unknown, business, enterprise, mixed, suggestedPlan };
}
