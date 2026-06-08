import { BUSINESS_QUOTA_VALUES, ENTERPRISE_QUOTA_VALUES, KNOWN_QUOTA_VALUES, PRICING } from '@/constants/pricing';
import { ProcessedData } from '@/types/csv';
import { isRequestUnitType, isSupportedUsageUnitType } from '@/utils/unitType';

export interface QuotaBreakdownResult {
  unknown: string[];
  business: string[];
  enterprise: string[];
  mixed: boolean;
  suggestedPlan: 'business' | 'enterprise' | null;
}

export type QuotaTier = 'business' | 'enterprise';

export function getQuotaTier(quotaValue: number | 'unknown' | undefined): QuotaTier | null {
  if (typeof quotaValue !== 'number') {
    return null;
  }

  if (BUSINESS_QUOTA_VALUES.includes(quotaValue)) {
    return 'business';
  }

  if (ENTERPRISE_QUOTA_VALUES.includes(quotaValue)) {
    return 'enterprise';
  }

  return null;
}

export function isBusinessQuotaValue(quotaValue: number | 'unknown' | undefined): boolean {
  return getQuotaTier(quotaValue) === 'business';
}

export function isEnterpriseQuotaValue(quotaValue: number | 'unknown' | undefined): boolean {
  return getQuotaTier(quotaValue) === 'enterprise';
}

export function isKnownQuotaValue(quotaValue: number | 'unknown' | undefined): quotaValue is number {
  return getQuotaTier(quotaValue) !== null;
}

export function isLegacyPremiumRequestQuotaValue(quotaValue: number | 'unknown' | undefined): quotaValue is number {
  return quotaValue === PRICING.BUSINESS_QUOTA || quotaValue === PRICING.ENTERPRISE_QUOTA;
}

function getQuotaTierRank(quotaValue: number | 'unknown' | undefined): number {
  const tier = getQuotaTier(quotaValue);
  if (tier === 'enterprise') {
    return 2;
  }
  if (tier === 'business') {
    return 1;
  }
  return 0;
}

// Parse quota value from string. Only recognized quota tiers are kept as
// numbers; anything else (blank, 'Unlimited', the non-billable sentinel, etc.)
// resolves to 'unknown' so plan detection considers only known values.
export function parseQuotaValue(quotaString: string): number | 'unknown' {
  const trimmed = quotaString.trim().toLowerCase();
  if (trimmed === 'unknown') {
    return 'unknown';
  }
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || !KNOWN_QUOTA_VALUES.includes(parsed)) {
    return 'unknown';
  }
  return parsed;
}

export function shouldReplaceQuotaValue(
  existing: number | 'unknown' | undefined,
  incoming: number | 'unknown'
): boolean {
  if (existing === undefined) {
    return true;
  }

  if (incoming === 'unknown') {
    return false;
  }

  if (existing === 'unknown') {
    return true;
  }

  const existingRank = getQuotaTierRank(existing);
  const incomingRank = getQuotaTierRank(incoming);

  if (incomingRank !== existingRank) {
    return incomingRank > existingRank;
  }

  return incoming > existing;
}

function buildUserQuotaMap(data: ProcessedData[], includeAiCreditUsage: boolean): Map<string, number | 'unknown'> {
  const userQuotas = new Map<string, number | 'unknown'>();

  for (const row of data) {
    const shouldUseQuota = includeAiCreditUsage
      ? isSupportedUsageUnitType(row.unitType, row.sku)
      : isRequestUnitType(row.unitType);

    if (row.isNonCopilotUsage || !shouldUseQuota) {
      continue;
    }

    const existing = userQuotas.get(row.user);
    const current = row.quotaValue;

    if (shouldReplaceQuotaValue(existing, current)) {
      userQuotas.set(row.user, current);
    }
  }

  return userQuotas;
}

/**
 * Build per-user premium request quotas from processed rows using the canonical
 * policy: numeric quotas win over unknown values, and the highest tier wins.
 */
export function buildUserQuotaMapFromRows(data: ProcessedData[]): Map<string, number | 'unknown'> {
  return buildUserQuotaMap(data, false);
}

export function buildUsageQuotaMapFromRows(data: ProcessedData[]): Map<string, number | 'unknown'> {
  return buildUserQuotaMap(data, true);
}

/**
 * Canonical quota tier classification: bucketizes each user's quota into
 * `unknown`, `business`, or `enterprise`, computes the `mixed` flag, and derives
 * `suggestedPlan`. This is the single source of truth for quota tier logic, shared
 * by both the ProcessedData and artifact-based breakdown builders.
 */
export function classifyQuotaMap(
  quotaByUser: Map<string, number | 'unknown'>
): QuotaBreakdownResult {
  const unknown: string[] = [];
  const business: string[] = [];
  const enterprise: string[] = [];

  for (const [user, quota] of quotaByUser) {
    if (quota === 'unknown') {
      unknown.push(user);
    } else if (isBusinessQuotaValue(quota)) {
      business.push(user);
    } else if (isEnterpriseQuotaValue(quota)) {
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

export function buildQuotaBreakdown(data: ProcessedData[]): QuotaBreakdownResult {
  return classifyQuotaMap(buildUsageQuotaMapFromRows(data));
}
