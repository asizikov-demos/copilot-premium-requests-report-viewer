import { UserSummary } from './transformations';
import { ProcessedData } from '@/types/csv';
import { getUserQuotaValue } from './quota';
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
  const totalOverageRequests = userData.reduce((total, user) => {
    const userQuota = getUserQuotaValue(processedData, user.user);
    const overage = calculateOverageRequests(user.totalRequests, userQuota);
    return total + overage;
  }, 0);
  const totalOverageCost = calculateOverageCost(totalOverageRequests);
  return { totalOverageRequests, totalOverageCost };
}
