import { CSVData, ProcessedData, AnalysisResults } from '@/types/csv';

import { buildProcessedDataFromRawRows } from '../ingestion/adapters';

import { buildQuotaBreakdown, buildUserQuotaMapFromRows } from './quota';
import type { UserSummary } from './types';

// Re-export for backwards compatibility
export type { UserSummary } from './types';

// Convert raw CSV rows into strongly typed processed data (UTC-sensitive: timestamps used as-is)
export function processCSVData(rawData: CSVData[]): ProcessedData[] {
  return buildProcessedDataFromRawRows(rawData);
}

export function analyzeData(data: ProcessedData[]): AnalysisResults {
  if (data.length === 0) {
    return {
      timeFrame: { start: '', end: '' },
      totalUniqueUsers: 0,
      usersExceedingQuota: 0,
      requestsByModel: [],
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

  const uniqueUsers = new Set(data.filter(row => !row.isNonCopilotUsage).map(row => row.user));
  const totalUniqueUsers = uniqueUsers.size;

  // Quota breakdown
  const quotaBreakdown = buildQuotaBreakdown(data.filter(row => !row.isNonCopilotUsage));

  // Users exceeding quota (using actual numeric quota values)
  const userQuotas = buildUserQuotaMapFromRows(data);

  const usersExceedingQuota = new Set<string>();
  const userTotalRequests = new Map<string, number>();
  data.forEach(row => {
    if (row.isNonCopilotUsage) {
      return;
    }
    const current = userTotalRequests.get(row.user) || 0;
    userTotalRequests.set(row.user, current + row.requestsUsed);
  });
  for (const [user, totalRequests] of userTotalRequests) {
    const quota = userQuotas.get(user);
    if (quota && quota !== 'unknown' && totalRequests > quota) {
      usersExceedingQuota.add(user);
    }
  }

  // Requests by model
  const modelRequests = new Map<string, number>();
  data.forEach(row => {
    modelRequests.set(row.model, (modelRequests.get(row.model) || 0) + row.requestsUsed);
  });
  const requestsByModel = Array.from(modelRequests.entries())
    .map(([model, totalRequests]) => ({ model, totalRequests }))
    .sort((a, b) => b.totalRequests - a.totalRequests);

  return {
    timeFrame,
    totalUniqueUsers,
    usersExceedingQuota: usersExceedingQuota.size,
    requestsByModel,
    quotaBreakdown
  };
}

export function analyzeUserData(data: ProcessedData[]): UserSummary[] {
  const userMap = new Map<string, UserSummary>();
  data.forEach(row => {
    if (row.isNonCopilotUsage) {
      return;
    }
    if (!userMap.has(row.user)) {
      userMap.set(row.user, {
        user: row.user,
        totalRequests: 0,
        modelBreakdown: {},
        organization: row.organization,
        costCenter: row.costCenter
      });
    }
    const userSummary = userMap.get(row.user)!;
    userSummary.totalRequests += row.requestsUsed;
    if (!userSummary.modelBreakdown[row.model]) userSummary.modelBreakdown[row.model] = 0;
    userSummary.modelBreakdown[row.model] += row.requestsUsed;
    if (!userSummary.organization && row.organization) {
      userSummary.organization = row.organization;
    }
    if (!userSummary.costCenter && row.costCenter) {
      userSummary.costCenter = row.costCenter;
    }
  });
  return Array.from(userMap.values()).sort((a, b) => b.totalRequests - a.totalRequests);
}
