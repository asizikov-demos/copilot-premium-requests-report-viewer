import { PRICING } from '@/constants/pricing';
import type { BillingArtifacts, QuotaArtifacts, UsageArtifacts } from '@/utils/ingestion';
import { calculateExcessCredits } from '@/utils/userCalculations';

const NEAR_QUOTA_FRACTION = 0.8;

export interface CostMonitoringUser {
  user: string;
  totalCredits: number;
  quota: number;
  excessCredits: number;
  billedNetCharge: number;
}

export interface CostOptimizationSummary {
  overQuotaUsers: CostMonitoringUser[];
  nearQuotaUsers: CostMonitoringUser[];
  totalOverQuotaUsers: number;
  totalBilledNetCharge: number;
  totalExcessCredits: number;
  missingBillingUsers: number;
}

/**
 * Monitor actual billed net charges for Business users in the current artifact scope.
 * Net charges are not necessarily attributable solely to quota overage.
 */
export function computeCostOptimizationFromArtifacts(
  usage: UsageArtifacts,
  quota: QuotaArtifacts,
  billing?: BillingArtifacts
): CostOptimizationSummary | null {
  const overQuotaUsers: CostMonitoringUser[] = [];
  const nearQuotaUsers: CostMonitoringUser[] = [];
  let missingBillingUsers = 0;
  let billedUsers = 0;

  for (const u of usage.users) {
    if (quota.quotaByUser.get(u.user) !== PRICING.BUSINESS_AI_CREDIT_QUOTA) continue;
    if (!Number.isFinite(u.totalCredits)) continue;

    const billedNetCharge = billing?.userMap.get(u.user)?.net;
    if (typeof billedNetCharge !== 'number' || !Number.isFinite(billedNetCharge)) {
      missingBillingUsers++;
      continue;
    }
    billedUsers++;

    const excessCredits = calculateExcessCredits(u.totalCredits, PRICING.BUSINESS_AI_CREDIT_QUOTA);
    const entry: CostMonitoringUser = {
      user: u.user,
      totalCredits: u.totalCredits,
      quota: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      excessCredits,
      billedNetCharge
    };

    if (excessCredits > 0) {
      overQuotaUsers.push(entry);
    } else if (u.totalCredits >= PRICING.BUSINESS_AI_CREDIT_QUOTA * NEAR_QUOTA_FRACTION) {
      nearQuotaUsers.push(entry);
    }
  }

  if (billedUsers === 0) return null;

  overQuotaUsers.sort((left, right) =>
    right.billedNetCharge - left.billedNetCharge || right.excessCredits - left.excessCredits || left.user.localeCompare(right.user)
  );
  nearQuotaUsers.sort((left, right) =>
    right.totalCredits - left.totalCredits || left.user.localeCompare(right.user)
  );

  return {
    overQuotaUsers,
    nearQuotaUsers,
    totalOverQuotaUsers: overQuotaUsers.length,
    totalBilledNetCharge: overQuotaUsers.reduce((sum, user) => sum + user.billedNetCharge, 0),
    totalExcessCredits: overQuotaUsers.reduce((sum, user) => sum + user.excessCredits, 0),
    missingBillingUsers
  };
}
