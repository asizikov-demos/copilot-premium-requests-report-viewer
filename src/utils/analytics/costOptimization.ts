import type { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';
import { PRICING, COST_OPTIMIZATION_THRESHOLDS } from '@/constants/pricing';

export interface CostOptimizationCandidate {
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

export interface CostOptimizationSummary {
  candidates: CostOptimizationCandidate[];
  totalCandidates: number;
  totalOverageCost: number;
  estimatedEnterpriseCost: number;
  totalPotentialSavings: number;
  approachingBreakEven: CostOptimizationCandidate[];
}

/**
 * Identify Copilot Business users (BUSINESS_QUOTA) whose overage is at least STRONG_CANDIDATE_THRESHOLD requests.
 * These users are strong candidates for upgrading to Copilot Enterprise (ENTERPRISE_QUOTA).
 */
export function computeCostOptimizationFromArtifacts(
  usage: UsageArtifacts,
  quota: QuotaArtifacts
): CostOptimizationSummary {
  const candidates: CostOptimizationCandidate[] = [];
  const approachingBreakEven: CostOptimizationCandidate[] = [];

  for (const u of usage.users) {
    const q = quota.quotaByUser.get(u.user);
    if (q !== PRICING.BUSINESS_QUOTA) continue;

    const overageRequests = Math.max(0, u.totalRequests - q);
    // Users with very low overage are not interesting for optimization scenarios.
    if (overageRequests < COST_OPTIMIZATION_THRESHOLDS.MIN_OVERAGE_THRESHOLD) continue;

    const overageCost = overageRequests * PRICING.OVERAGE_RATE_PER_REQUEST;
    const enterpriseQuota = PRICING.ENTERPRISE_QUOTA;
    const enterpriseExtraCapacity = enterpriseQuota - q;
    const enterpriseUpgradeCost = PRICING.ENTERPRISE_UPGRADE_DELTA;
    const potentialSavings = Math.max(0, overageCost - enterpriseUpgradeCost);

    const baseCandidate: CostOptimizationCandidate = {
      user: u.user,
      totalRequests: u.totalRequests,
      quota: q,
      overageRequests,
      overageCost,
      enterpriseQuota,
      enterpriseExtraCapacity,
      potentialSavings,
      enterpriseUpgradeCost
    };

    // Strong recommendation: overage clearly above break-even (>= STRONG_CANDIDATE_THRESHOLD PRUs)
    if (overageRequests >= COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD) {
      candidates.push(baseCandidate);
    } else if (overageRequests >= COST_OPTIMIZATION_THRESHOLDS.APPROACHING_BREAKEVEN_THRESHOLD) {
      // Approaching break-even: within ~(STRONG_CANDIDATE_THRESHOLD - APPROACHING_BREAKEVEN_THRESHOLD) PRUs of the tipping point.
      approachingBreakEven.push(baseCandidate);
    }
  }

  const totalOverageCost = candidates.reduce((sum, c) => sum + c.overageCost, 0);
  const estimatedEnterpriseCost = candidates.length * PRICING.ENTERPRISE_UPGRADE_DELTA;
  const totalPotentialSavings = Math.max(0, totalOverageCost - estimatedEnterpriseCost);

  return {
    candidates,
    totalCandidates: candidates.length,
    totalOverageCost,
    estimatedEnterpriseCost,
    totalPotentialSavings,
    approachingBreakEven
  };
}
