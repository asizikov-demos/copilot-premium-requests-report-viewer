import { CSVData, ProcessedData, AnalysisResults } from '@/types/csv';

import { buildDateKeys } from '../dateKeys';
import { isCodeReviewModel } from '../productClassification';
import { buildQuotaBreakdown, buildUserQuotaMapFromRows, parseQuotaValue } from './quota';
import { UserSummary } from './types';

// Re-export for backwards compatibility
export type { UserSummary } from './types';

// Convert raw CSV rows into strongly typed processed data (UTC-sensitive: timestamps used as-is)
export function processCSVData(rawData: CSVData[]): ProcessedData[] {
  return rawData.map(row => {
    // Build a UTC timestamp from YYYY-MM-DD (DO NOT localize)
    const timestamp = new Date(`${row.date}T00:00:00Z`);
    const keys = buildDateKeys(timestamp);
    const trimmedUsername = row.username.trim();
    const isNonCopilotCodeReview = trimmedUsername.length === 0 && isCodeReviewModel(row.model);
    const totalQuotaRaw = isNonCopilotCodeReview ? '0' : row.total_monthly_quota || 'Unlimited';
    return {
      timestamp,
      user: trimmedUsername,
      model: row.model,
      requestsUsed: parseFloat(row.quantity),
      exceedsQuota: row.exceeds_quota ? row.exceeds_quota.toLowerCase() === 'true' : false,
      totalQuota: isNonCopilotCodeReview ? '0' : totalQuotaRaw,
      quotaValue: isNonCopilotCodeReview ? 0 : parseQuotaValue(totalQuotaRaw),
      product: row.product,
      sku: row.sku,
      organization: row.organization,
      costCenter: row.cost_center_name,
      appliedCostPerQuantity: row.applied_cost_per_quantity ? parseFloat(row.applied_cost_per_quantity) : undefined,
      grossAmount: row.gross_amount ? parseFloat(row.gross_amount) : undefined,
      discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : undefined,
      netAmount: row.net_amount ? parseFloat(row.net_amount) : undefined,
      isNonCopilotUsage: isNonCopilotCodeReview,
      usageBucket: isNonCopilotCodeReview ? 'non_copilot_code_review' : undefined,
      ...keys
    };
  });
}

export function analyzeData(data: ProcessedData[]): AnalysisResults {
  if (data.length === 0) {
    return {
      timeFrame: { start: '', end: '' },
      totalUniqueUsers: 0,
      usersExceedingQuota: 0,
      requestsByModel: [],
      quotaBreakdown: {
        unlimited: [],
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
  const quotaBreakdown = buildQuotaBreakdown(data);

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
    if (quota && quota !== 'unlimited' && totalRequests > quota) {
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
