import type { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';

export interface CostOptimisationCandidate {
  user: string;
  totalRequests: number;
  quota: number;
  overageRequests: number;
  overageCost: number;
  enterpriseQuota: number;
  enterpriseExtraCapacity: number;
  potentialSavings: number;
  enterpriseUpgradeCost: number;
}

export interface CostOptimisationSummary {
  candidates: CostOptimisationCandidate[];
  totalCandidates: number;
  totalOverageCost: number;
  estimatedEnterpriseCost: number;
  totalPotentialSavings: number;
}

/**
 * Identify Copilot Business users (300 quota) whose overage is at least 500 requests.
 * These users are strong candidates for upgrading to Copilot Enterprise (1000 quota).
 */
export function computeCostOptimisationFromArtifacts(
  usage: UsageArtifacts,
  quota: QuotaArtifacts
): CostOptimisationSummary {
  const candidates: CostOptimisationCandidate[] = [];
  const ENTERPRISE_UPGRADE_DELTA_USD = 20;

  for (const u of usage.users) {
    const q = quota.quotaByUser.get(u.user);
    if (q !== PRICING.BUSINESS_QUOTA) continue;

    const overageRequests = Math.max(0, u.totalRequests - q);
    if (overageRequests < 500) continue;

    const overageCost = overageRequests * PRICING.OVERAGE_RATE_PER_REQUEST;
    const enterpriseQuota = PRICING.ENTERPRISE_QUOTA;
    const enterpriseExtraCapacity = enterpriseQuota - q;
    const enterpriseUpgradeCost = ENTERPRISE_UPGRADE_DELTA_USD;
    const potentialSavings = Math.max(0, overageCost - enterpriseUpgradeCost);

    candidates.push({
      user: u.user,
      totalRequests: u.totalRequests,
      quota: q,
      overageRequests,
      overageCost,
      enterpriseQuota,
      enterpriseExtraCapacity,
      potentialSavings,
      enterpriseUpgradeCost
    });
  }

  const totalOverageCost = candidates.reduce((sum, c) => sum + c.overageCost, 0);
  const estimatedEnterpriseCost = candidates.length * ENTERPRISE_UPGRADE_DELTA_USD;
  const totalPotentialSavings = Math.max(0, totalOverageCost - estimatedEnterpriseCost);

  return {
    candidates,
    totalCandidates: candidates.length,
    totalOverageCost,
    estimatedEnterpriseCost,
    totalPotentialSavings
  };
}
