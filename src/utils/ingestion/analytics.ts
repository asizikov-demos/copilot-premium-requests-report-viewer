/**
 * Analytics derivations directly from ingestion artifacts.
 * This module replaces ProcessedData scans with O(1)/O(n) passes over
 * already aggregated usage/quota/bucket artifacts produced during streaming ingestion.
 *
 * Phase 1 scope (todos 1-3):
 *  - derive analysis core: time frame, totalUniqueUsers, usersExceedingQuota,
 *    creditsByModel, quotaBreakdown, suggested plan
 *  - mirror the shape of existing AnalysisResults to enable incremental adoption
 */

import { PRICING } from '@/constants/pricing';
import type { AnalysisResults, ProcessedData } from '@/types/csv';
import type { CodeReviewAnalysis } from '@/types/csv';
import { CodingAgentAnalysis, UserDailyData } from '@/types/csv';
import { buildAdvisoriesFromCategories, type Advisory } from '@/utils/analytics/advisory';
import { classifyConsumptionUser } from '@/utils/analytics/insights';
import type { FeatureUtilizationStats, InsightsOverviewData, UserConsumptionCategory } from '@/utils/analytics/insights';
import { classifyQuotaMap, isKnownQuotaValue } from '@/utils/analytics/quota';
import { enumerateDatesInclusive, monthKeyToLabel } from '@/utils/dateKeys';
import { isCodeReviewModel, isCodingAgentModel } from '@/utils/productClassification';
import {
  UNATTRIBUTED_AI_CREDIT_BUCKET,
  type DailyBucketsArtifacts,
  type Aggregator,
  type FeatureUsageArtifacts,
  type NormalizedRow,
  type TokenArtifacts,
  type QuotaArtifacts,
  type UsageArtifacts,
} from './types';
import { DailyBucketsAggregator } from './DailyBucketsAggregator';
import { FeatureUsageAggregator } from './FeatureUsageAggregator';
import { QuotaAggregator } from './QuotaAggregator';
import { UsageAccumulator } from './UsageAccumulator';
import { TokenAggregator } from './TokenAggregator';

export type { DailyBucketsArtifacts } from './types';

// Legacy DailyCodingAgentUsageDatum type recreated locally (originally from codingAgent.ts)
export interface DailyCodingAgentUsageDatum { date: string; dailyCredits: number; cumulativeCredits: number; }


interface FeatureUserEntry {
  user: string;
  totalCredits: number;
  featureCredits: number;
  featurePercentage: number;
  quota: number | 'unknown';
  models: string[];
}

function collectFeatureUsers(
  usage: UsageArtifacts,
  quota: QuotaArtifacts,
  modelFilter: (model: string) => boolean
): { users: FeatureUserEntry[]; totalFeatureCredits: number } {
  const users: FeatureUserEntry[] = [];
  let totalFeatureCredits = 0;

  for (const u of usage.users) {
    const models = Object.keys(u.modelBreakdown).filter(modelFilter);
    if (models.length === 0) continue;

    const featureCredits = models.reduce((sum, model) => sum + u.modelBreakdown[model], 0);
    totalFeatureCredits += featureCredits;
    users.push({
      user: u.user,
      totalCredits: u.totalCredits,
      featureCredits,
      featurePercentage: u.totalCredits > 0 ? (featureCredits / u.totalCredits) * 100 : 0,
      quota: quota.quotaByUser.get(u.user) ?? 'unknown',
      models,
    });
  }

  return { users, totalFeatureCredits };
}

/** Build time frame (start/end) from daily bucket date range. */
export function buildTimeFrame(daily: DailyBucketsArtifacts): { start: string; end: string } {
  if (!daily.dateRange) return { start: '', end: '' };
  return { start: daily.dateRange.min, end: daily.dateRange.max };
}

/**
 * Build a UsageArtifacts from already-filtered ProcessedData rows.
 * Used when billing period (selectedMonths) is active to produce month-sliced
 * artifacts for downstream analysis functions.
 */
export function buildUsageArtifactsFromProcessedData(filtered: ProcessedData[]): UsageArtifacts {
  const accumulator = new UsageAccumulator();
  for (const r of filtered) {
    accumulator.addRow({
      user: r.user,
      model: r.model,
      quantity: r.creditsUsed,
      billingQuantity: r.billingQuantity,
      usageUnit: r.usageUnit,
      organization: r.organization,
      costCenter: r.costCenter,
      isUnattributedUsage: r.isUnattributedUsage,
      usageBucket: r.usageBucket,
    });
  }
  return accumulator.finalize();
}

/**
 * Builds the normalized aggregator input shape from ProcessedData rows.
 *
 * ProcessedData keeps cached date fields, while NormalizedRow is the
 * streaming aggregator contract. The source date remains UTC-preserved.
 */
export function buildNormalizedRowFromProcessedData(row: ProcessedData): NormalizedRow {
  return {
    date: row.iso,
    day: row.dateKey,
    user: row.user,
    model: row.model,
    quantity: row.creditsUsed,
    quotaRaw: row.totalQuota,
    quotaValue: row.quotaValue,
    product: row.product,
    sku: row.sku,
    unitType: row.unitType,
    usageUnit: row.usageUnit,
    billingQuantity: row.billingQuantity,
    organization: row.organization,
    costCenter: row.costCenter,
    appliedCostPerQuantity: row.appliedCostPerQuantity,
    grossAmount: row.grossAmount,
    discountAmount: row.discountAmount,
    netAmount: row.netAmount,
    aicQuantity: row.aicQuantity,
    aicGrossAmount: row.aicGrossAmount,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cacheReadTokens: row.cacheReadTokens,
    cacheWriteTokens: row.cacheWriteTokens,
    isUnattributedUsage: row.isUnattributedUsage,
    usageBucket: row.usageBucket,
  };
}

/**
 * Runs an aggregator over ProcessedData rows using the shared normalized
 * row adapter and standard pricing context, then returns the finalized artifact.
 */
function runAggregatorOverProcessedData<T>(aggregator: Aggregator<T>, processed: ProcessedData[]): T {
  const ctx = { pricing: PRICING };
  aggregator.init?.(ctx);
  for (const row of processed) {
    aggregator.onRow(buildNormalizedRowFromProcessedData(row), ctx);
  }
  return aggregator.finalize(ctx);
}

export function buildQuotaArtifactsFromProcessedData(processed: ProcessedData[]): QuotaArtifacts {
  return runAggregatorOverProcessedData(new QuotaAggregator(), processed);
}

export function buildTokenArtifactsFromProcessedData(processed: ProcessedData[]): TokenArtifacts {
  return runAggregatorOverProcessedData(new TokenAggregator(), processed);
}

export function buildDailyBucketsArtifactsFromProcessedData(processed: ProcessedData[]): DailyBucketsArtifacts {
  return runAggregatorOverProcessedData(new DailyBucketsAggregator(), processed);
}

export function buildFeatureUsageArtifactsFromProcessedData(processed: ProcessedData[]): FeatureUsageArtifacts {
  return runAggregatorOverProcessedData(new FeatureUsageAggregator(), processed);
}

/**
 * Build quota breakdown lists & suggested plan using quotaArtifacts.
 * Delegates tier classification to the shared classifyQuotaMap to avoid
 * duplicating quota tier logic.
 */
export function buildQuotaBreakdownFromArtifacts(quota: QuotaArtifacts): AnalysisResults['quotaBreakdown'] {
  return classifyQuotaMap(quota.quotaByUser);
}

/** Build creditsByModel array from usageArtifacts.modelTotals */
export function buildCreditsByModel(usage: UsageArtifacts): Array<{ model: string; totalCredits: number }> {
  return Object.entries(usage.modelTotals)
    .map(([model, totalCredits]) => ({ model, totalCredits }))
    .sort((a, b) => b.totalCredits - a.totalCredits);
}

/** Determine users exceeding quota from usage + quota artifacts. */
export function buildUsersExceedingQuota(daily: DailyBucketsArtifacts, quota: QuotaArtifacts): number {
  const totals = new Map<string, number>();
  for (const [date, users] of daily.dailyUserTotals) {
    for (const [user, credits] of users) {
      const key = `${date.slice(0, 7)}:${user}`;
      totals.set(key, (totals.get(key) ?? 0) + credits);
    }
  }
  const exceeded = new Set<string>();
  for (const [key, credits] of totals) {
    const user = key.slice(8);
    const q = quota.quotaByUser.get(user);
    if (isKnownQuotaValue(q) && credits > q) exceeded.add(user);
  }
  return exceeded.size;
}

/**
 * Primary artifact-based analysis builder.
 */
export function deriveAnalysisFromArtifacts(
  usage: UsageArtifacts,
  quota: QuotaArtifacts,
  daily: DailyBucketsArtifacts
): AnalysisResults {
  const timeFrame = buildTimeFrame(daily);
  const creditsByModel = buildCreditsByModel(usage);
  const quotaBreakdown = buildQuotaBreakdownFromArtifacts(quota);
  const usersExceedingQuota = buildUsersExceedingQuota(daily, quota);
  const totalUniqueUsers = usage.userCount; // direct from artifact

  return {
    timeFrame,
    totalUniqueUsers,
    usersExceedingQuota,
    creditsByModel,
    quotaBreakdown
  };
}

export interface ArtifactCoreAnalysis {
  analysis: AnalysisResults;
}

// -----------------------------
// Daily Cumulative (Buckets)
// -----------------------------
export interface DailyCumulativeData { date: string; [user: string]: string | number; }

/**
 * Construct daily cumulative per-user usage series from daily user totals.
 * Derives cumulative values without raw row scans.
 */
function buildDailyCumulativeDataFromUserTotals(
  dailyUserTotals: Map<string, Map<string, number>>,
  dateRange: DailyBucketsArtifacts['dateRange']
): DailyCumulativeData[] {
  if (!dateRange) return [];
  const { min, max } = dateRange;
  const dates = enumerateDatesInclusive(min, max);

  // Collect all users encountered in any day map
  const users = new Set<string>();
  for (const dayMap of dailyUserTotals.values()) {
    for (const user of dayMap.keys()) users.add(user);
  }
  const userList = Array.from(users).sort();

  // Initialize cumulative totals
  const cumulative = new Map<string, number>();
  userList.forEach(u => cumulative.set(u, 0));

  const result: DailyCumulativeData[] = [];
  let currentMonth = '';
  for (const date of dates) {
    if (date.slice(0, 7) !== currentMonth) {
      currentMonth = date.slice(0, 7);
      cumulative.clear();
    }
    const dayMap = dailyUserTotals.get(date);
    if (dayMap) {
      for (const [user, val] of dayMap) {
        cumulative.set(user, (cumulative.get(user) || 0) + val);
      }
    }
    const row: DailyCumulativeData = { date };
    for (const u of userList) row[u] = cumulative.get(u) || 0;
    result.push(row);
  }
  return result;
}

export function buildDailyCumulativeDataFromArtifacts(daily: DailyBucketsArtifacts): DailyCumulativeData[] {
  return buildDailyCumulativeDataFromUserTotals(daily.dailyUserTotals, daily.dateRange);
}

// -----------------------------
// Coding Agent Adoption From Artifacts
// -----------------------------
export function analyzeCodingAgentAdoptionFromArtifacts(usage: UsageArtifacts, quota: QuotaArtifacts): CodingAgentAnalysis {
  if (usage.users.length === 0) return { totalUsers: 0, totalUniqueUsers: 0, totalCodingAgentCredits: 0, adoptionRate: 0, users: [] };
  const totalUniqueUsers = usage.userCount;
  const { users, totalFeatureCredits: totalCodingAgentCredits } = collectFeatureUsers(usage, quota, isCodingAgentModel);
  const codingAgentUsers: CodingAgentAnalysis['users'] = users.map(user => ({
    user: user.user,
    totalCredits: user.totalCredits,
    codingAgentCredits: user.featureCredits,
    codingAgentPercentage: user.featurePercentage,
    quota: user.quota,
    models: user.models
  }));
  codingAgentUsers.sort((a, b) => b.codingAgentCredits - a.codingAgentCredits);
  const adoptionRate = totalUniqueUsers > 0 ? (codingAgentUsers.length / totalUniqueUsers) * 100 : 0;
  return { totalUsers: codingAgentUsers.length, totalUniqueUsers, totalCodingAgentCredits, adoptionRate, users: codingAgentUsers };
}

// -----------------------------
// User Daily Model Data (Modal) From Artifacts
// -----------------------------

/**
 * Build per-user per-model daily stacked + cumulative dataset for user detail views
 * WITHOUT scanning raw rows. Requires DailyBucketsAggregator (with dailyUserModelTotals)
 * + Usage artifacts. Falls back to empty array if prerequisite artifact shape incomplete.
 */
export function buildUserDailyModelDataFromArtifacts(
  daily: DailyBucketsArtifacts,
  usage: UsageArtifacts,
  user: string
): UserDailyData[] {
  return buildUserDailyModelDataFromModelTotals(daily, usage, user, daily.dailyUserModelTotals);
}

function buildUserDailyModelDataFromModelTotals(
  daily: DailyBucketsArtifacts,
  usage: UsageArtifacts,
  user: string,
  dailyUserModelTotals: Map<string, Map<string, Map<string, number>>> | undefined
): UserDailyData[] {
  if (!daily.dateRange || !dailyUserModelTotals) return [];
  // Locate user aggregate for model list & quick existence check
  const userAgg = usage.users.find(u => u.user === user);
  if (!userAgg) return [];
  const models = Object.keys(userAgg.modelBreakdown).sort();
  const { min, max } = daily.dateRange;
  const dates = enumerateDatesInclusive(min, max);
  let cumulative = 0;
  let currentMonth = '';
  const result: UserDailyData[] = [];
  for (const date of dates) {
    if (date.slice(0, 7) !== currentMonth) {
      currentMonth = date.slice(0, 7);
      cumulative = 0;
    }
    const dayUserMap = dailyUserModelTotals.get(date);
    const modelMap = dayUserMap?.get(user);
    const row: UserDailyData = { date, totalCumulative: 0 } as UserDailyData;
    let dailyTotal = 0;
    for (const m of models) {
      const v = modelMap?.get(m) || 0;
      row[m] = v;
      dailyTotal += v;
    }
    cumulative += dailyTotal;
    row.totalCumulative = cumulative;
    result.push(row as UserDailyData);
  }
  return result;
}

// -----------------------------
// Daily Model Usage (All Users) From Artifacts
// -----------------------------

export interface DailyModelUsageDatum {
  date: string;
  totalCredits: number;
  // dynamic model keys mapping to daily counts
  [model: string]: string | number;
}

function buildDailyModelUsageFromTotals(
  daily: DailyBucketsArtifacts,
  usage: UsageArtifacts,
  dailyUserModelTotalsMap: Map<string, Map<string, Map<string, number>>> | undefined,
  specialBucketKey?: typeof UNATTRIBUTED_AI_CREDIT_BUCKET
): DailyModelUsageDatum[] {
  if (!daily.dateRange || !dailyUserModelTotalsMap) return [];

  const { min, max } = daily.dateRange;
  const dates = enumerateDatesInclusive(min, max);

  // Discover global model list from usage artifacts for stable ordering
  const allModels = Object.keys(usage.modelTotals).sort();

  const result: DailyModelUsageDatum[] = [];
  for (const date of dates) {
    const dayUserMap = dailyUserModelTotalsMap.get(date);
    const specialModelMap = specialBucketKey
      ? daily.dailyBucketModelTotals?.get(date)?.get(specialBucketKey)
      : undefined;
    const row: DailyModelUsageDatum = { date, totalCredits: 0 };
    let dayTotal = 0;

    for (const model of allModels) {
      let modelTotal = 0;
      if (dayUserMap) {
        for (const modelMap of dayUserMap.values()) {
          modelTotal += modelMap.get(model) || 0;
        }
      }
      modelTotal += specialModelMap?.get(model) ?? 0;
      row[model] = modelTotal;
      dayTotal += modelTotal;
    }

    row.totalCredits = dayTotal;
    result.push(row);
  }

  return result;
}

/**
 * Build per-day per-model stacked dataset for all users combined.
 * Shape mirrors UserDailyData but aggregated across users, without cumulative line.
 * Returns a dense series across the full date range; days with no activity are
 * present with zero totals to keep the X-axis continuous.
 */
export function buildDailyModelUsageFromArtifacts(
  daily: DailyBucketsArtifacts,
  usage: UsageArtifacts
): DailyModelUsageDatum[] {
  return buildDailyModelUsageFromTotals(
    daily,
    usage,
    daily.dailyUserModelTotals,
    UNATTRIBUTED_AI_CREDIT_BUCKET
  );
}

// -----------------------------
// Feature Utilization From FeatureUsageArtifacts
// -----------------------------
/**
 * Build FeatureUtilizationStats directly from FeatureUsageAggregator artifacts.
 */
export function buildFeatureUtilizationFromArtifacts(featureUsage: FeatureUsageArtifacts): FeatureUtilizationStats {
  const { featureTotals, featureUsers, specialTotals } = featureUsage;
  const avg = (total: number, count: number) => (count > 0 ? total / count : 0);
  const codeReviewUsers = featureUsers.codeReview.size;
  const codingAgentUsers = featureUsers.codingAgent.size;
  const sparkUsers = featureUsers.spark.size;
  const codeQualityUsers = featureUsers.codeQuality.size;
  const codeReviewCredits = featureTotals.codeReview;
  const attributedCodeReview = Math.max(0, codeReviewCredits - specialTotals.unattributedCodeReview);
  const attributedCodeQuality = Math.max(0, featureTotals.codeQuality - specialTotals.unattributedCodeQuality);
  return {
    codeReview: {
      totalCredits: codeReviewCredits,
      averagePerUser: avg(attributedCodeReview, codeReviewUsers),
      userCount: codeReviewUsers
    },
    codingAgent: {
      totalCredits: featureTotals.codingAgent,
      averagePerUser: avg(featureTotals.codingAgent, codingAgentUsers),
      userCount: codingAgentUsers
    },
    spark: {
      totalCredits: featureTotals.spark,
      averagePerUser: avg(featureTotals.spark, sparkUsers),
      userCount: sparkUsers
    },
    codeQuality: {
      totalCredits: featureTotals.codeQuality,
      averagePerUser: avg(attributedCodeQuality, codeQualityUsers),
      userCount: codeQualityUsers
    },
  };
}

// -----------------------------
// Consumption Categories From Artifacts
// -----------------------------
/** Build user consumption categories without scanning processedData. */
export function buildConsumptionCategoriesFromArtifacts(
  usage: UsageArtifacts,
  quota: QuotaArtifacts
): InsightsOverviewData {
  const categorized: UserConsumptionCategory[] = usage.users.map(u => {
    const quotaVal = quota.quotaByUser.get(u.user) ?? 'unknown';
    return {
      user: u.user,
      totalCredits: u.totalCredits,
      quota: quotaVal,
      ...classifyConsumptionUser(u.totalCredits, quotaVal)
    };
  }).sort((a, b) => b.consumptionPercentage - a.consumptionPercentage);
  return {
    powerUsers: categorized.filter(c => c.category === 'power'),
    averageUsers: categorized.filter(c => c.category === 'average'),
    lowAdoptionUsers: categorized.filter(c => c.category === 'low')
  };
}

// -----------------------------
// Advisories From Artifacts
// -----------------------------
/**
 * Build advisories leveraging artifact-derived consumption categories.
 * Builds advisories without raw row scans.
 */
export function buildAdvisoriesFromArtifacts(
  categories: InsightsOverviewData,
  usage: UsageArtifacts
): Advisory[] {
  const totalUsers = usage.userCount;
  if (totalUsers === 0) return [];

  return buildAdvisoriesFromCategories(categories.lowAdoptionUsers, totalUsers);
}

// -----------------------------
// Coding Agent Daily Usage From Artifacts
// -----------------------------
/**
 * Shared implementation for building a daily usage time series filtered to a
 * subset of models. Iterates the provided daily user/model map, sums per-model quantities for
 * models matching the predicate, includes only days with > 0 usage, sorts by
 * ascending date, and computes a running cumulative total.
 */
function buildDailyModelSubsetUsageFromArtifacts(
  dailyUserModelTotals: Map<string, Map<string, Map<string, number>>> | undefined,
  modelFilter: (model: string) => boolean
): DailyCodingAgentUsageDatum[] {
  if (!dailyUserModelTotals) return [];
  const dayTotals: Array<{ date: string; total: number }> = [];
  for (const [date, userMap] of dailyUserModelTotals.entries()) {
    let daySum = 0;
    for (const modelMap of userMap.values()) {
      for (const [model, qty] of modelMap.entries()) {
        if (modelFilter(model)) {
          daySum += qty;
        }
      }
    }
    if (daySum > 0) dayTotals.push({ date, total: daySum });
  }
  if (dayTotals.length === 0) return [];
  dayTotals.sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  let currentMonth = '';
  return dayTotals.map(d => {
    if (d.date.slice(0, 7) !== currentMonth) {
      currentMonth = d.date.slice(0, 7);
      cumulative = 0;
    }
    cumulative += d.total;
    return { date: d.date, dailyCredits: d.total, cumulativeCredits: cumulative } as DailyCodingAgentUsageDatum;
  });
}

/**
 * Build daily coding agent usage time series (date, dailyCredits, cumulativeCredits)
 * without scanning raw processedData rows. Leverages DailyBucketsAggregator's
 * dailyUserModelTotals nested map. Builds daily credit usage
 * behavior by:
 *  - Including ONLY days with > 0 coding agent credits
 *  - Sorting by ascending date
 *  - Computing cumulativeCredits as running sum of dailyCredits
 * Falls back to empty array if required per-model breakdown map is absent.
 */
export function buildDailyCodingAgentUsageFromArtifacts(
  daily: DailyBucketsArtifacts
): DailyCodingAgentUsageDatum[] {
  return buildDailyModelSubsetUsageFromArtifacts(daily.dailyUserModelTotals, isCodingAgentModel);
}

// -----------------------------
// Code Review Adoption From Artifacts
// -----------------------------
export function analyzeCodeReviewAdoptionFromArtifacts(usage: UsageArtifacts, quota: QuotaArtifacts): CodeReviewAnalysis {
  if (usage.users.length === 0) {
    return { totalUsers: 0, totalUniqueUsers: 0, totalCodeReviewCredits: 0, adoptionRate: 0, users: [] };
  }

  const totalUniqueUsers = usage.userCount;
  const { users, totalFeatureCredits } = collectFeatureUsers(usage, quota, isCodeReviewModel);
  const totalReviewUsers = users.length;
  const codeReviewUsers: CodeReviewAnalysis['users'] = users.map(user => ({
    user: user.user,
    totalCredits: user.totalCredits,
    codeReviewCredits: user.featureCredits,
    codeReviewPercentage: user.featurePercentage,
    quota: user.quota,
    models: user.models
  }));

  codeReviewUsers.sort((a, b) => b.codeReviewCredits - a.codeReviewCredits);
  const adoptionRate = totalUniqueUsers > 0 ? (totalReviewUsers / totalUniqueUsers) * 100 : 0;
  return { totalUsers: totalReviewUsers, totalUniqueUsers, totalCodeReviewCredits: totalFeatureCredits, adoptionRate, users: codeReviewUsers };
}

// -----------------------------
// Daily Code Review Usage From Artifacts
// -----------------------------
export function buildDailyCodeReviewUsageFromArtifacts(
  daily: DailyBucketsArtifacts
): DailyCodingAgentUsageDatum[] {
  return buildDailyModelSubsetUsageFromArtifacts(daily.dailyUserModelTotals, isCodeReviewModel);
}

// -----------------------------
// Month List From Artifacts
// -----------------------------
/**
 * Build month list (value, label) directly from DailyBucketsArtifacts.months.
 * Returns an empty array when months are not present.
 */
export function buildMonthListFromArtifacts(daily: DailyBucketsArtifacts): { value: string; label: string }[] {
  if (!daily.months || daily.months.length === 0) return [];
  return daily.months.map(key => ({ value: key, label: monthKeyToLabel(key) }));
}
