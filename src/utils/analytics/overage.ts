import type { ProcessedData } from '@/types/csv';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';

import { buildUserQuotaMapFromRows, isLegacyPremiumRequestQuotaValue } from './quota';
import type { UserSummary } from './types';

export interface OverageSummary {
  totalOverageRequests: number;
  totalOverageCost: number;
}

/**
 * Legacy overage summary for callers that already have UserSummary rows.
 * Prefer computeOverageSummaryFromArtifacts for new ingestion pipelines because
 * the artifact-based path avoids rebuilding usage totals from processed rows.
 */
export function computeOverageSummary(userData: UserSummary[], processedData: ProcessedData[]): OverageSummary {
  const quotaMap = buildUserQuotaMapFromRows(processedData);
  const totalOverageRequests = userData.reduce((total, user) => {
    const userQuota = quotaMap.get(user.user) ?? 'unknown';
    const overage = calculateOverageRequests(
      user.totalRequests,
      isLegacyPremiumRequestQuotaValue(userQuota) ? userQuota : 'unknown'
    );
    return total + overage;
  }, 0);
  const totalOverageCost = calculateOverageCost(totalOverageRequests);
  return { totalOverageRequests, totalOverageCost };
}
