import { UserSummary } from './powerUsers';
import { ProcessedData } from '@/types/csv';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';

export interface OverageSummary {
  totalOverageRequests: number;
  totalOverageCost: number;
}

/**
 * Compute aggregate overage requests & cost across all users taking into account
 * per-user quota values (including 'unlimited').
 * Pure + deterministic for unit testing.
 */
export function computeOverageSummary(userData: UserSummary[], processedData: ProcessedData[]): OverageSummary {
  // Build a quota map (first occurrence defines user's plan) in O(R)
  const quotaMap = new Map<string, number | 'unlimited'>();
  for (const row of processedData) {
    if (!quotaMap.has(row.user)) quotaMap.set(row.user, row.quotaValue);
  }
  const totalOverageRequests = userData.reduce((total, user) => {
    const userQuota = quotaMap.get(user.user) ?? 'unlimited';
    const overage = calculateOverageRequests(user.totalRequests, userQuota);
    return total + overage;
  }, 0);
  const totalOverageCost = calculateOverageCost(totalOverageRequests);
  return { totalOverageRequests, totalOverageCost };
}
