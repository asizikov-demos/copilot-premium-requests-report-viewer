import { ProcessedData } from '@/types/csv';
import { UserSummary } from './transformations';
import { PRICING } from '@/constants/pricing';

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
}

export const CONSUMPTION_THRESHOLDS = Object.freeze({
  powerMinPct: 90,
  averageMinPct: 45
});

export function calculateFeatureUtilization(processedData: ProcessedData[]): FeatureUtilizationStats {
  const codeReviewUsers = new Map<string, number>();
  const codingAgentUsers = new Map<string, number>();
  const sparkUsers = new Map<string, number>();
  let totalCodeReviewSessions = 0; let totalCodingAgentSessions = 0; let totalSparkSessions = 0;
  processedData.forEach(row => {
    const modelLower = row.model.toLowerCase();
    if (modelLower.includes('code review')) {
      totalCodeReviewSessions += row.requestsUsed;
      codeReviewUsers.set(row.user, (codeReviewUsers.get(row.user) || 0) + row.requestsUsed);
    }
    if (modelLower.includes('coding agent') || modelLower.includes('padawan')) {
      totalCodingAgentSessions += row.requestsUsed;
      codingAgentUsers.set(row.user, (codingAgentUsers.get(row.user) || 0) + row.requestsUsed);
    }
    if (modelLower.includes('spark')) {
      totalSparkSessions += row.requestsUsed;
      sparkUsers.set(row.user, (sparkUsers.get(row.user) || 0) + row.requestsUsed);
    }
  });
  const avg = (total: number, count: number) => (count > 0 ? total / count : 0);
  return {
    codeReview: { totalSessions: totalCodeReviewSessions, averagePerUser: avg(totalCodeReviewSessions, codeReviewUsers.size), userCount: codeReviewUsers.size },
    codingAgent: { totalSessions: totalCodingAgentSessions, averagePerUser: avg(totalCodingAgentSessions, codingAgentUsers.size), userCount: codingAgentUsers.size },
    spark: { totalSessions: totalSparkSessions, averagePerUser: avg(totalSparkSessions, sparkUsers.size), userCount: sparkUsers.size }
  };
}

export function categorizeUserConsumption(userData: UserSummary[], processedData: ProcessedData[]): InsightsOverviewData {
  const userQuotaMap = new Map<string, number | 'unlimited'>();
  processedData.forEach(row => { if (!userQuotaMap.has(row.user)) userQuotaMap.set(row.user, row.quotaValue); });
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
