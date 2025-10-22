import { CSVData, NewCSVData, ProcessedData, AnalysisResults } from '@/types/csv';
import { parseQuotaValue, buildQuotaBreakdown } from './quota';
import { buildDateKeys } from '../dateKeys';

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
      const timestamp = new Date(legacy.Timestamp); // preserve UTC
      const keys = buildDateKeys(timestamp);
      return {
        timestamp,
        user: legacy.User,
        model: legacy.Model,
        requestsUsed: parseFloat(legacy['Requests Used']),
        exceedsQuota: legacy['Exceeds Monthly Quota'].toLowerCase() === 'true',
        totalQuota: legacy['Total Monthly Quota'],
        quotaValue: parseQuotaValue(legacy['Total Monthly Quota']),
        ...keys,
        sourceFormat: 'legacy'
      };
    } else {
      const newer = row as NewCSVData;
      // Build a UTC timestamp from YYYY-MM-DD (DO NOT localize)
      const timestamp = new Date(`${newer.date}T00:00:00Z`);
      const keys = buildDateKeys(timestamp);
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
        ...keys,
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
    start: sortedData[0].dateKey,
    end: sortedData[sortedData.length - 1].dateKey
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
  const sortedData = [...data].sort((a, b) => a.epoch - b.epoch);
  const users = Array.from(new Set(data.map(d => d.user))).sort();
  const startEpoch = sortedData[0].epoch;
  const endEpoch = sortedData[sortedData.length - 1].epoch;
  // Pre-group records by dateKey to avoid repeated filtering inside loop.
  const byDate = new Map<string, ProcessedData[]>();
  for (const row of sortedData) {
    const arr = byDate.get(row.dateKey);
    if (arr) arr.push(row); else byDate.set(row.dateKey, [row]);
  }
  const userTotals = new Map<string, number>();
  users.forEach(u => userTotals.set(u, 0));
  const result: DailyCumulativeData[] = [];
  // Iterate day by day using Date arithmetic from start timestamp.
  for (let current = new Date(startEpoch); current.getTime() <= endEpoch; current.setUTCDate(current.getUTCDate() + 1)) {
    const dateStr = current.toISOString().slice(0, 10); // UTC YYYY-MM-DD
    const dayRequests = byDate.get(dateStr) || [];
    for (const r of dayRequests) {
      userTotals.set(r.user, (userTotals.get(r.user) || 0) + r.requestsUsed);
    }
    const dataPoint: DailyCumulativeData = { date: dateStr };
    for (const u of users) dataPoint[u] = userTotals.get(u) || 0;
    result.push(dataPoint);
  }
  return result;
}

export function generateUserDailyModelData(data: ProcessedData[], userName: string): import('@/types/csv').UserDailyData[] {
  const userData = data.filter(d => d.user === userName);
  if (userData.length === 0) return [];
  const allSorted = [...data].sort((a, b) => a.epoch - b.epoch);
  const startEpoch = allSorted[0].epoch;
  const endEpoch = allSorted[allSorted.length - 1].epoch;
  const sortedUserData = [...userData].sort((a, b) => a.epoch - b.epoch);
  const userModels = Array.from(new Set(userData.map(d => d.model))).sort();
  // Pre-group user data by dateKey for O(1) daily lookup.
  const byDate = new Map<string, ProcessedData[]>();
  for (const row of sortedUserData) {
    const arr = byDate.get(row.dateKey);
    if (arr) arr.push(row); else byDate.set(row.dateKey, [row]);
  }
  let cumulativeTotal = 0;
  const result: import('@/types/csv').UserDailyData[] = [];
  for (let current = new Date(startEpoch); current.getTime() <= endEpoch; current.setUTCDate(current.getUTCDate() + 1)) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayRequests = byDate.get(dateStr) || [];
    const dailyByModel: Record<string, number> = {};
    for (const m of userModels) dailyByModel[m] = 0;
    let dailyTotal = 0;
    for (const req of dayRequests) { dailyByModel[req.model] += req.requestsUsed; dailyTotal += req.requestsUsed; }
    cumulativeTotal += dailyTotal;
    result.push({ date: dateStr, totalCumulative: cumulativeTotal, ...dailyByModel });
  }
  return result;
}
