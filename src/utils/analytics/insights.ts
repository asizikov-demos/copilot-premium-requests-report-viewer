import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import { buildUserQuotaMapFromRows } from '@/utils/analytics/quota';

import type { UserSummary } from './types';

export interface UserConsumptionCategory {
  user: string;
  totalRequests: number;
  quota: number | 'unlimited';
  consumptionPercentage: number;
  category: 'power' | 'average' | 'low';
}

export interface InsightsOverviewData {
  powerUsers: UserConsumptionCategory[];
  averageUsers: UserConsumptionCategory[];
  lowAdoptionUsers: UserConsumptionCategory[];
}

export interface FeatureUtilizationStats {
  codeReview: { totalSessions: number; averagePerUser: number; userCount: number; };
  codingAgent: { totalSessions: number; averagePerUser: number; userCount: number; };
  spark: { totalSessions: number; averagePerUser: number; userCount: number; };
  nonCopilotCodeReview: { totalSessions: number; };
}

export const CONSUMPTION_THRESHOLDS = Object.freeze({
  powerMinPct: 90,
  averageMinPct: 45
});

export function categorizeUserConsumption(userData: UserSummary[], processedData: ProcessedData[]): InsightsOverviewData {
  const userQuotaMap = buildUserQuotaMapFromRows(processedData);
  const categorized = userData.map(u => {
    const quota = userQuotaMap.get(u.user) ?? 'unlimited';
    const pct = (typeof quota === 'number' && quota > 0) ? (u.totalRequests / quota) * 100 : 0;
    let category: 'power' | 'average' | 'low' = 'low';
    if (pct >= CONSUMPTION_THRESHOLDS.powerMinPct) category = 'power';
    else if (pct >= CONSUMPTION_THRESHOLDS.averageMinPct) category = 'average';
    return { user: u.user, totalRequests: u.totalRequests, quota, consumptionPercentage: pct, category };
  }).sort((a,b) => b.consumptionPercentage - a.consumptionPercentage);
  return {
    powerUsers: categorized.filter(c => c.category === 'power'),
    averageUsers: categorized.filter(c => c.category === 'average'),
    lowAdoptionUsers: categorized.filter(c => c.category === 'low')
  };
}

export function calculateUnusedValue(users: UserConsumptionCategory[]): number {
  let total = 0;
  for (const u of users) {
    if (typeof u.quota === 'number' && u.quota > 0) {
      const unused = Math.max(0, u.quota - u.totalRequests);
      total += unused * PRICING.OVERAGE_RATE_PER_REQUEST;
    }
  }
  return total;
}
