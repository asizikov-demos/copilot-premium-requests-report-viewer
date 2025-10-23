import { ProcessedData, PowerUsersAnalysis } from '@/types/csv';
import { UsageArtifacts, QuotaArtifacts, DailyBucketsArtifacts } from '@/utils/ingestion/types';
import { analyzePowerUsersFromArtifacts, computeWeeklyQuotaExhaustionFromArtifacts, computeOverageSummaryFromArtifacts, WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';

// -----------------------------
// Legacy Constants & Scoring (preserved for tests)
// -----------------------------
export interface UserSummary { user: string; totalRequests: number; modelBreakdown: Record<string, number>; }

interface SpecialFeatureConfig { readonly keyword: string; readonly score: number; readonly description: string; }
export const SPECIAL_FEATURES_CONFIG: readonly SpecialFeatureConfig[] = [
  { keyword: 'code review', score: 8, description: 'Code Review feature usage' },
  { keyword: 'coding agent', score: 8, description: 'Coding Agent feature usage' },
  { keyword: 'padawan', score: 8, description: 'Padawan feature usage' },
  { keyword: 'spark', score: 4, description: 'Spark feature usage' }
] as const;
export const MAX_SPECIAL_FEATURES_SCORE = 20;

export function calculateSpecialFeaturesScore(models: string[]): number {
  const modelSet = new Set(models.map(m => m.toLowerCase()));
  let totalScore = 0;
  const usedFeatureTypes = new Set<string>();
  const featureGroups = [
    { type: 'code_review', keywords: ['code review'], score: 8 },
    { type: 'coding_agent', keywords: ['coding agent', 'padawan'], score: 8 },
    { type: 'spark', keywords: ['spark'], score: 4 }
  ];
  for (const group of featureGroups) {
    const hasFeature = group.keywords.some(keyword => modelSet.has(keyword));
    if (hasFeature && !usedFeatureTypes.has(group.type)) {
      totalScore += group.score;
      usedFeatureTypes.add(group.type);
    }
  }
  return Math.min(totalScore, MAX_SPECIAL_FEATURES_SCORE);
}

// -----------------------------
// Artifact Builders From ProcessedData (minimal subset needed by shims)
// -----------------------------
function buildUsageArtifacts(processed: ProcessedData[]): UsageArtifacts {
  const userMap = new Map<string, { totalRequests: number; modelBreakdown: Record<string, number>; }>();
  const modelTotals: Record<string, number> = {};
  for (const row of processed) {
    let entry = userMap.get(row.user);
    if (!entry) { entry = { totalRequests: 0, modelBreakdown: {} }; userMap.set(row.user, entry); }
    entry.totalRequests += row.requestsUsed;
    entry.modelBreakdown[row.model] = (entry.modelBreakdown[row.model] || 0) + row.requestsUsed;
    modelTotals[row.model] = (modelTotals[row.model] || 0) + row.requestsUsed;
  }
  const users = Array.from(userMap.entries()).map(([user, v]) => {
    // derive topModel
    let topModel: string | undefined; let topModelValue = 0;
    for (const [m, qty] of Object.entries(v.modelBreakdown)) { if (qty > topModelValue) { topModelValue = qty; topModel = m; } }
    return { user, totalRequests: v.totalRequests, modelBreakdown: v.modelBreakdown, topModel, topModelValue };
  });
  return { users, modelTotals, userCount: users.length, modelCount: Object.keys(modelTotals).length };
}

function buildQuotaArtifacts(processed: ProcessedData[]): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unlimited'>();
  const conflicts = new Map<string, Set<number | 'unlimited'>>();
  const distinctQuotas = new Set<number>();
  for (const row of processed) {
    const val = row.quotaValue;
    if (!quotaByUser.has(row.user)) quotaByUser.set(row.user, val);
    else if (quotaByUser.get(row.user) !== val) {
      let set = conflicts.get(row.user); if (!set) { set = new Set(); conflicts.set(row.user, set); }
      set.add(quotaByUser.get(row.user)!); set.add(val);
    }
    if (typeof val === 'number') distinctQuotas.add(val);
  }
  const hasMixedQuotas = distinctQuotas.size > 1;
  // Mixed licenses accounts for presence of unlimited + numeric vs pure numeric uniform
  let hasMixedLicenses = false;
  let sawUnlimited = false; let sawNumeric = false;
  for (const v of quotaByUser.values()) { if (v === 'unlimited') sawUnlimited = true; else sawNumeric = true; }
  hasMixedLicenses = sawUnlimited && sawNumeric;
  return { quotaByUser, conflicts, distinctQuotas, hasMixedQuotas, hasMixedLicenses };
}

function buildDailyBucketsArtifacts(processed: ProcessedData[]): DailyBucketsArtifacts {
  const dailyUserTotals = new Map<string, Map<string, number>>();
  let min: string | null = null; let max: string | null = null;
  const monthsSet = new Set<string>();
  for (const row of processed) {
    const dateKey = row.dateKey; const monthKey = row.monthKey;
    monthsSet.add(monthKey);
    if (!min || dateKey < min) min = dateKey; if (!max || dateKey > max) max = dateKey;
    let userMap = dailyUserTotals.get(dateKey);
    if (!userMap) { userMap = new Map(); dailyUserTotals.set(dateKey, userMap); }
    userMap.set(row.user, (userMap.get(row.user) || 0) + row.requestsUsed);
  }
  return { dailyUserTotals, dateRange: min && max ? { min, max } : null, months: Array.from(monthsSet).sort() };
}

// -----------------------------
// Shim Functions (legacy signatures delegating to artifact implementations)
// -----------------------------
const DEFAULT_MIN_REQUESTS = 20;

export function analyzePowerUsers(processedData: ProcessedData[], minRequestsThreshold: number = DEFAULT_MIN_REQUESTS): PowerUsersAnalysis {
  if (processedData.length === 0) return { powerUsers: [], totalQualifiedUsers: 0 };
  const usage = buildUsageArtifacts(processedData);
  return analyzePowerUsersFromArtifacts(usage, minRequestsThreshold);
}

export function computeWeeklyQuotaExhaustion(processedData: ProcessedData[]): WeeklyQuotaExhaustionBreakdown {
  if (processedData.length === 0) return { totalUsersExhausted: 0, weeks: [] };
  const usage = buildUsageArtifacts(processedData); // usage not directly needed; included for completeness if future logic expands
  const quota = buildQuotaArtifacts(processedData);
  const daily = buildDailyBucketsArtifacts(processedData);
  return computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
}

export interface OverageSummary { totalOverageRequests: number; totalOverageCost: number; }
export function computeOverageSummary(userData: UserSummary[], processedData: ProcessedData[]): OverageSummary {
  // Legacy logic preserved for exact test parity (avoids minor floating point timing differences in artifact path)
  const quotaMap = new Map<string, number | 'unlimited'>();
  for (const row of processedData) { if (!quotaMap.has(row.user)) quotaMap.set(row.user, row.quotaValue); }
  let totalOverageRequests = 0;
  for (const u of userData) {
    const quotaVal = quotaMap.get(u.user) ?? 'unlimited';
    totalOverageRequests += calculateOverageRequests(u.totalRequests, quotaVal);
  }
  return { totalOverageRequests, totalOverageCost: calculateOverageCost(totalOverageRequests) };
}

// Convenience wrapper for tests migrating to artifact version directly
export function computeOverageSummaryArtifacts(processedData: ProcessedData[]): OverageSummary {
  const usage = buildUsageArtifacts(processedData);
  const quota = buildQuotaArtifacts(processedData);
  return computeOverageSummaryFromArtifacts(usage, quota);
}
