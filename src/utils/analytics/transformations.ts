import { CSVData, NewCSVData, ProcessedData, AnalysisResults } from '@/types/csv';
import { parseQuotaValue, buildQuotaBreakdown } from './quota';

export interface UserSummary {
  user: string;
  totalRequests: number;
  modelBreakdown: Record<string, number>;
}

// Convert raw CSV rows into strongly typed processed data (UTC-sensitive: timestamps used as-is)
// Detect row format (legacy vs new) using presence of discriminant keys.
function detectRowFormat(row: CSVData | NewCSVData): 'legacy' | 'new' {
  return (row as CSVData).Timestamp !== undefined ? 'legacy' : 'new';
}

// Convert raw mixed-format rows (legacy or new) into unified processed records.
// This maintains backward compatibility while enabling expanded analytics.
export function processCSVData(rawData: (CSVData | NewCSVData)[]): ProcessedData[] {
  return rawData.map(row => {
    const format = detectRowFormat(row);
    if (format === 'legacy') {
      const legacy = row as CSVData;
      return {
        timestamp: new Date(legacy.Timestamp), // preserve UTC
        user: legacy.User,
        model: legacy.Model,
        requestsUsed: parseFloat(legacy['Requests Used']),
        exceedsQuota: legacy['Exceeds Monthly Quota'].toLowerCase() === 'true',
        totalQuota: legacy['Total Monthly Quota'],
        quotaValue: parseQuotaValue(legacy['Total Monthly Quota']),
        sourceFormat: 'legacy'
      };
    } else {
      const newer = row as NewCSVData;
      // Build a UTC timestamp from YYYY-MM-DD (DO NOT localize)
      const timestamp = new Date(`${newer.date}T00:00:00Z`);
      const totalQuotaRaw = newer.total_monthly_quota || 'Unlimited';
      return {
        timestamp,
        user: newer.username,
        model: newer.model,
        requestsUsed: parseFloat(newer.quantity),
        exceedsQuota: newer.exceeds_quota ? newer.exceeds_quota.toLowerCase() === 'true' : false,
        totalQuota: totalQuotaRaw,
        quotaValue: parseQuotaValue(totalQuotaRaw),
        product: newer.product,
        sku: newer.sku,
        organization: newer.organization,
        costCenter: newer.cost_center_name,
        appliedCostPerQuantity: newer.applied_cost_per_quantity ? parseFloat(newer.applied_cost_per_quantity) : undefined,
        grossAmount: newer.gross_amount ? parseFloat(newer.gross_amount) : undefined,
        discountAmount: newer.discount_amount ? parseFloat(newer.discount_amount) : undefined,
        netAmount: newer.net_amount ? parseFloat(newer.net_amount) : undefined,
        sourceFormat: 'new'
      };
    }
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
    start: sortedData[0].timestamp.toISOString().split('T')[0],
    end: sortedData[sortedData.length - 1].timestamp.toISOString().split('T')[0]
  };

  const uniqueUsers = new Set(data.map(row => row.user));
  const totalUniqueUsers = uniqueUsers.size;

  // Quota breakdown
  const quotaBreakdown = buildQuotaBreakdown(data);

  // Users exceeding quota (using actual numeric quota values)
  const userQuotas = new Map<string, number | 'unlimited'>();
  data.forEach(row => { if (!userQuotas.has(row.user)) userQuotas.set(row.user, row.quotaValue); });

  const usersExceedingQuota = new Set<string>();
  const userTotalRequests = new Map<string, number>();
  data.forEach(row => {
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
    if (!userMap.has(row.user)) {
      userMap.set(row.user, { user: row.user, totalRequests: 0, modelBreakdown: {} });
    }
    const userSummary = userMap.get(row.user)!;
    userSummary.totalRequests += row.requestsUsed;
    if (!userSummary.modelBreakdown[row.model]) userSummary.modelBreakdown[row.model] = 0;
    userSummary.modelBreakdown[row.model] += row.requestsUsed;
  });
  return Array.from(userMap.values()).sort((a, b) => b.totalRequests - a.totalRequests);
}

export interface DailyCumulativeData { date: string; [user: string]: string | number; }

export function generateDailyCumulativeData(data: ProcessedData[]): DailyCumulativeData[] {
  if (data.length === 0) return [];
  const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const users = Array.from(new Set(data.map(d => d.user))).sort();
  const startDate = new Date(sortedData[0].timestamp);
  const endDate = new Date(sortedData[sortedData.length - 1].timestamp);
  const userTotals = new Map<string, number>();
  users.forEach(u => userTotals.set(u, 0));
  const result: DailyCumulativeData[] = [];
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const dayRequests = sortedData.filter(d => d.timestamp.toISOString().split('T')[0] === dateStr);
    dayRequests.forEach(r => userTotals.set(r.user, (userTotals.get(r.user) || 0) + r.requestsUsed));
    const dataPoint: DailyCumulativeData = { date: dateStr };
    users.forEach(u => { dataPoint[u] = userTotals.get(u) || 0; });
    result.push(dataPoint);
  }
  return result;
}

export function generateUserDailyModelData(data: ProcessedData[], userName: string): import('@/types/csv').UserDailyData[] {
  const userData = data.filter(d => d.user === userName);
  if (userData.length === 0) return [];
  const allSorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const startDate = new Date(allSorted[0].timestamp);
  const endDate = new Date(allSorted[allSorted.length - 1].timestamp);
  const sortedUserData = [...userData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const userModels = Array.from(new Set(userData.map(d => d.model))).sort();
  let cumulativeTotal = 0;
  const result: import('@/types/csv').UserDailyData[] = [];
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const dayRequests = sortedUserData.filter(d => d.timestamp.toISOString().split('T')[0] === dateStr);
    const dailyByModel: Record<string, number> = {};
    userModels.forEach(m => { dailyByModel[m] = 0; });
    let dailyTotal = 0;
    dayRequests.forEach(req => { dailyByModel[req.model] += req.requestsUsed; dailyTotal += req.requestsUsed; });
    cumulativeTotal += dailyTotal;
    result.push({ date: dateStr, totalCumulative: cumulativeTotal, ...dailyByModel });
  }
  return result;
}
