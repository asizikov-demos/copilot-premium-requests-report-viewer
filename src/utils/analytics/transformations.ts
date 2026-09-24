import { ProcessedData, AnalysisResults } from '@/types/csv';

import { buildQuotaBreakdown, buildUserQuotaMapFromRows, isKnownQuotaValue } from './quota';

// Re-export for backwards compatibility
export type { UserSummary } from './types';

export function analyzeData(data: ProcessedData[]): AnalysisResults {
  if (data.length === 0) {
    return {
      timeFrame: { start: '', end: '' },
      totalUniqueUsers: 0,
      usersExceedingQuota: 0,
      creditsByModel: [],
      quotaBreakdown: {
        unknown: [],
        business: [],
        enterprise: [],
        mixed: false,
        suggestedPlan: null
      }
    };
  }

  const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const timeFrame = {
    start: sortedData[0].dateKey,
    end: sortedData[sortedData.length - 1].dateKey
  };

  const uniqueUsers = new Set(data.filter(row => !row.isUnattributedUsage).map(row => row.user));
  const totalUniqueUsers = uniqueUsers.size;

  // Quota breakdown
  const quotaBreakdown = buildQuotaBreakdown(data.filter(row => !row.isUnattributedUsage));

  // Users exceeding quota (using actual numeric quota values)
  const userQuotas = buildUserQuotaMapFromRows(data);

  const usersExceedingQuota = new Set<string>();
  const userMonthlyCredits = new Map<string, number>();
  data.forEach(row => {
    if (row.isUnattributedUsage) {
      return;
    }
    const key = `${row.monthKey}:${row.user}`;
    userMonthlyCredits.set(key, (userMonthlyCredits.get(key) ?? 0) + row.creditsUsed);
  });
  for (const [key, totalCredits] of userMonthlyCredits) {
    const user = key.slice(8);
    const quota = userQuotas.get(user);
    if (isKnownQuotaValue(quota) && totalCredits > quota) {
      usersExceedingQuota.add(user);
    }
  }

  // AI Credits by model
  const modelCredits = new Map<string, number>();
  data.forEach(row => {
    modelCredits.set(row.model, (modelCredits.get(row.model) || 0) + row.creditsUsed);
  });
  const creditsByModel = Array.from(modelCredits.entries())
    .map(([model, totalCredits]) => ({ model, totalCredits }))
    .sort((a, b) => b.totalCredits - a.totalCredits);

  return {
    timeFrame,
    totalUniqueUsers,
    usersExceedingQuota: usersExceedingQuota.size,
    creditsByModel,
    quotaBreakdown
  };
}
