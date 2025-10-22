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

export function buildQuotaBreakdown(data: ProcessedData[]): QuotaBreakdownResult {
  const userQuotas = new Map<string, number | 'unlimited'>();
  data.forEach(row => {
    if (!userQuotas.has(row.user)) {
      userQuotas.set(row.user, row.quotaValue);
    }
  });

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

// NOTE: getUserQuotaValue removed. Prefer artifact-based getUserQuota (O(1)) or derive directly
// from processed rows (first occurrence) where needed.
