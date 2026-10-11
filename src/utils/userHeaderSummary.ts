import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import { isCodeReviewModel, isCodingAgentModel } from '@/utils/productClassification';

export interface UserHeaderSummary {
  organizations: string[];
  costCenters: string[];
  daysActive: number;
  /** Days in the billing month; null when usage spans multiple months. */
  daysInPeriod: number | null;
  totalConsumed: number;
  /**
   * Billed split when billing columns exist (discounted vs. net credits);
   * otherwise a per-month split against the quota. Null when neither is available.
   */
  includedConsumed: number | null;
  additionalConsumed: number | null;
  /** Null when the export has no billing columns. */
  totalCost: number | null;
  additionalCost: number | null;
  cloudAgentUsed: boolean;
  codeReviewUsed: boolean;
}

function sortedUnique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function daysInUtcMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildUserHeaderSummary(
  userData: ProcessedData[],
  quota: number | 'unknown',
  hasBillingData: boolean
): UserHeaderSummary {
  const monthlyCredits = new Map<string, number>();
  const activeDays = new Set<string>();
  let totalConsumed = 0;
  let gross = 0;
  let discount = 0;
  let net = 0;
  let cloudAgentUsed = false;
  let codeReviewUsed = false;

  for (const row of userData) {
    monthlyCredits.set(row.monthKey, (monthlyCredits.get(row.monthKey) ?? 0) + row.creditsUsed);
    totalConsumed += row.creditsUsed;
    gross += row.grossAmount ?? 0;
    discount += row.discountAmount ?? 0;
    net += row.netAmount ?? 0;
    if (row.creditsUsed > 0) {
      activeDays.add(row.dateKey);
    }
    if (isCodingAgentModel(row.model)) {
      cloudAgentUsed = true;
    }
    if (isCodeReviewModel(row.model)) {
      codeReviewUsed = true;
    }
  }

  let includedConsumed: number | null = null;
  let additionalConsumed: number | null = null;
  if (hasBillingData) {
    includedConsumed = discount / PRICING.AI_CREDIT_USD_VALUE;
    additionalConsumed = net / PRICING.AI_CREDIT_USD_VALUE;
  } else if (quota !== 'unknown') {
    includedConsumed = 0;
    additionalConsumed = 0;
    for (const credits of monthlyCredits.values()) {
      includedConsumed += Math.min(credits, quota);
      additionalConsumed += Math.max(0, credits - quota);
    }
  }

  return {
    organizations: sortedUnique(userData.map((row) => row.organization)),
    costCenters: sortedUnique(userData.map((row) => row.costCenter)),
    daysActive: activeDays.size,
    daysInPeriod: monthlyCredits.size === 1 ? daysInUtcMonth(Array.from(monthlyCredits.keys())[0]) : null,
    totalConsumed,
    includedConsumed,
    additionalConsumed,
    totalCost: hasBillingData ? gross : null,
    additionalCost: hasBillingData ? net : null,
    cloudAgentUsed,
    codeReviewUsed,
  };
}
