import type { ProcessedData } from '@/types/csv';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';

import { buildUserQuotaMapFromRows } from './quota';
import type { UserSummary } from './types';

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
  const quotaMap = buildUserQuotaMapFromRows(processedData);
  const totalOverageRequests = userData.reduce((total, user) => {
    const userQuota = quotaMap.get(user.user) ?? 'unlimited';
    const overage = calculateOverageRequests(user.totalRequests, userQuota);
    return total + overage;
  }, 0);
  const totalOverageCost = calculateOverageCost(totalOverageRequests);
  return { totalOverageRequests, totalOverageCost };
}
