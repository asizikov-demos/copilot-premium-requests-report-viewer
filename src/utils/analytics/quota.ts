import { PRICING } from '@/constants/pricing';
import { ProcessedData } from '@/types/csv';

export interface QuotaBreakdownResult {
  unlimited: string[];
  business: string[];
  enterprise: string[];
  mixed: boolean;
  suggestedPlan: 'business' | 'enterprise' | null;
}

// Parse quota value from string
export function parseQuotaValue(quotaString: string): number | 'unlimited' {
  const trimmed = quotaString.trim().toLowerCase();
  if (trimmed === 'unlimited') {
    return 'unlimited';
  }
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? 'unlimited' : parsed;
}

/**
 * Build per-user quotas from processed rows using the canonical policy:
 * 'unlimited' wins over numeric quotas, otherwise the highest numeric quota wins.
 */
export function buildUserQuotaMapFromRows(data: ProcessedData[]): Map<string, number | 'unlimited'> {
  const userQuotas = new Map<string, number | 'unlimited'>();

  for (const row of data) {
    if (row.isNonCopilotUsage) {
      continue;
    }

    const existing = userQuotas.get(row.user);
    const current = row.quotaValue;

    if (
      existing === undefined
      || current === 'unlimited'
      || (typeof current === 'number' && typeof existing === 'number' && current > existing)
    ) {
      userQuotas.set(row.user, current);
    }
  }

  return userQuotas;
}

export function buildQuotaBreakdown(data: ProcessedData[]): QuotaBreakdownResult {
  const userQuotas = buildUserQuotaMapFromRows(data);

  const unlimited: string[] = [];
  const business: string[] = [];
  const enterprise: string[] = [];

  for (const [user, quota] of userQuotas) {
    if (quota === 'unlimited') {
      unlimited.push(user);
    } else if (quota === PRICING.BUSINESS_QUOTA) {
      business.push(user);
    } else if (quota === PRICING.ENTERPRISE_QUOTA) {
      enterprise.push(user);
    }
  }

  const quotaTypes = [
    unlimited.length > 0 ? 'unlimited' : null,
    business.length > 0 ? 'business' : null,
    enterprise.length > 0 ? 'enterprise' : null
  ].filter(Boolean);

  const mixed = quotaTypes.length > 1;
  let suggestedPlan: 'business' | 'enterprise' | null = null;
  if (!mixed && unlimited.length === 0) {
    if (business.length > 0 && enterprise.length === 0) {
      suggestedPlan = 'business';
    } else if (enterprise.length > 0 && business.length === 0) {
      suggestedPlan = 'enterprise';
    }
  }

  return { unlimited, business, enterprise, mixed, suggestedPlan };
}
