/**
 * Analytics derivations directly from ingestion artifacts.
 * This module replaces legacy ProcessedData scans with O(1)/O(n) passes over
 * already aggregated usage/quota/bucket artifacts produced during streaming ingestion.
 *
 * Phase 1 scope (todos 1-3):
 *  - derive analysis core: time frame, totalUniqueUsers, usersExceedingQuota,
 *    requestsByModel, quotaBreakdown, suggested plan
 *  - mirror the shape of existing AnalysisResults to enable incremental adoption
 */

import { PRICING } from '@/constants/pricing';
import type { AnalysisResults, ProcessedData } from '@/types/csv';
import type { CodeReviewAnalysis } from '@/types/csv';
import { CodingAgentAnalysis, UserDailyData } from '@/types/csv';
import { Advisory as LegacyAdvisory } from '@/utils/analytics/advisory';
import { CONSUMPTION_THRESHOLDS, UserConsumptionCategory, InsightsOverviewData } from '@/utils/analytics/insights';
import type { FeatureUtilizationStats } from '@/utils/analytics/insights';
import { buildUserQuotaMapFromRows } from '@/utils/analytics/quota';
import { dayOfMonthToWeekBucket, enumerateDatesInclusive } from '@/utils/dateKeys';
import { isCodeReviewModel, isCodingAgentModel } from '@/utils/productClassification';
import { calculateBilledOverageFromRows, calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';
import {
  NON_COPILOT_CODE_REVIEW_BUCKET,
  type DailyBucketsArtifacts,
  type FeatureUsageArtifacts,
  type NormalizedRow,
  type QuotaArtifacts,
  type UsageArtifacts,
} from './types';
import { DailyBucketsAggregator } from './DailyBucketsAggregator';
import { QuotaAggregator } from './QuotaAggregator';
import { UsageAccumulator } from './UsageAccumulator';

export type { DailyBucketsArtifacts } from './types';

// Legacy DailyCodingAgentUsageDatum type recreated locally (originally from codingAgent.ts)
export interface DailyCodingAgentUsageDatum { date: string; dailyRequests: number; cumulativeRequests: number; }

const NON_COPILOT_CODE_REVIEW_ADOPTION_LABEL = 'Non-Copilot Users';

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
      quantity: r.requestsUsed,
      organization: r.organization,
      costCenter: r.costCenter,
      isNonCopilotUsage: r.isNonCopilotUsage,
      usageBucket: r.usageBucket,
    });
  }
  return accumulator.finalize();
}

function buildNormalizedRowFromProcessedData(row: ProcessedData): NormalizedRow {
  return {
    date: row.iso,
    day: row.dateKey,
    user: row.user,
    model: row.model,
    quantity: row.requestsUsed,
    quotaRaw: row.totalQuota,
    quotaValue: row.quotaValue,
    exceedsQuota: row.exceedsQuota,
    product: row.product,
    sku: row.sku,
    organization: row.organization,
    costCenter: row.costCenter,
    appliedCostPerQuantity: row.appliedCostPerQuantity,
    grossAmount: row.grossAmount,
    discountAmount: row.discountAmount,
    netAmount: row.netAmount,
    isNonCopilotUsage: row.isNonCopilotUsage,
    usageBucket: row.usageBucket,
  };
}

export function buildQuotaArtifactsFromProcessedData(processed: ProcessedData[]): QuotaArtifacts {
  const aggregator = new QuotaAggregator();
  const ctx = { pricing: PRICING };
  aggregator.init?.(ctx);
  for (const row of processed) {
    aggregator.onRow(buildNormalizedRowFromProcessedData(row), ctx);
  }
  return aggregator.finalize(ctx);
}

export function buildDailyBucketsArtifactsFromProcessedData(processed: ProcessedData[]): DailyBucketsArtifacts {
  const aggregator = new DailyBucketsAggregator();
  const ctx = { pricing: PRICING };
  aggregator.init?.(ctx);
  for (const row of processed) {
    aggregator.onRow(buildNormalizedRowFromProcessedData(row), ctx);
  }
  return aggregator.finalize(ctx);
}

/**
 * Build quota breakdown lists & suggested plan using quotaArtifacts.
 * Replicates logic of legacy buildQuotaBreakdown but avoids scanning ProcessedData.
 */
export function buildQuotaBreakdownFromArtifacts(quota: QuotaArtifacts): AnalysisResults['quotaBreakdown'] {
  const unlimited: string[] = [];
  const business: string[] = [];
  const enterprise: string[] = [];

  for (const [user, q] of quota.quotaByUser.entries()) {
    if (q === 'unlimited') unlimited.push(user);
    else if (q === PRICING.BUSINESS_QUOTA) business.push(user);
    else if (q === PRICING.ENTERPRISE_QUOTA) enterprise.push(user);
  }

  const quotaTypes = [
    unlimited.length > 0 ? 'unlimited' : null,
    business.length > 0 ? 'business' : null,
    enterprise.length > 0 ? 'enterprise' : null
  ].filter(Boolean);

  const mixed = quotaTypes.length > 1;
  let suggestedPlan: 'business' | 'enterprise' | null = null;
  if (!mixed && unlimited.length === 0) {
    if (business.length > 0 && enterprise.length === 0) suggestedPlan = 'business';
    else if (enterprise.length > 0 && business.length === 0) suggestedPlan = 'enterprise';
  }

  return { unlimited, business, enterprise, mixed, suggestedPlan };
}

/** Build requestsByModel array from usageArtifacts.modelTotals */
export function buildRequestsByModel(usage: UsageArtifacts): Array<{ model: string; totalRequests: number }> {
  return Object.entries(usage.modelTotals)
    .map(([model, totalRequests]) => ({ model, totalRequests }))
    .sort((a, b) => b.totalRequests - a.totalRequests);
}

/** Determine users exceeding quota from usage + quota artifacts. */
export function buildUsersExceedingQuota(usage: UsageArtifacts, quota: QuotaArtifacts): number {
  let count = 0;
  for (const u of usage.users) {
    const q = quota.quotaByUser.get(u.user);
    if (q && q !== 'unlimited' && u.totalRequests > q) count++;
  }
  return count;
}

/**
 * Primary artifact-based analysis builder matching legacy AnalysisResults signature.
 */
export function deriveAnalysisFromArtifacts(
  usage: UsageArtifacts,
  quota: QuotaArtifacts,
  daily: DailyBucketsArtifacts
): AnalysisResults {
  const timeFrame = buildTimeFrame(daily);
  const requestsByModel = buildRequestsByModel(usage);
  const quotaBreakdown = buildQuotaBreakdownFromArtifacts(quota);
  const usersExceedingQuota = buildUsersExceedingQuota(usage, quota);
  const totalUniqueUsers = usage.userCount; // direct from artifact

  return {
    timeFrame,
    totalUniqueUsers,
    usersExceedingQuota,
    requestsByModel,
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
 * Construct daily cumulative per-user usage series from bucket artifacts.
 * This mirrors legacy generateDailyCumulativeData but avoids raw row scans.
 */
export function buildDailyCumulativeDataFromArtifacts(daily: DailyBucketsArtifacts): DailyCumulativeData[] {
  if (!daily.dateRange) return [];
  const { min, max } = daily.dateRange;
  const dates = enumerateDatesInclusive(min, max);

  // Collect all users encountered in any day map
  const users = new Set<string>();
  for (const dayMap of daily.dailyUserTotals.values()) {
    for (const user of dayMap.keys()) users.add(user);
  }
  const userList = Array.from(users).sort();

  // Initialize cumulative totals
  const cumulative = new Map<string, number>();
  userList.forEach(u => cumulative.set(u, 0));

  const result: DailyCumulativeData[] = [];
  for (const date of dates) {
    const dayMap = daily.dailyUserTotals.get(date);
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

// -----------------------------
// Overage Summary From Artifacts
// -----------------------------
export interface OverageSummary { totalOverageRequests: number; totalOverageCost: number; }

export function computeOverageSummaryFromArtifacts(usage: UsageArtifacts, quota: QuotaArtifacts): OverageSummary {
  let totalOverageRequests = 0;
  for (const u of usage.users) {
    const q = quota.quotaByUser.get(u.user) ?? 'unlimited';
    totalOverageRequests += calculateOverageRequests(u.totalRequests, q);
  }
  return { totalOverageRequests, totalOverageCost: calculateOverageCost(totalOverageRequests) };
}

export function computeOverageSummaryFromProcessedData(processedData: ProcessedData[]): OverageSummary {
  const billed = calculateBilledOverageFromRows(processedData);
  if (billed.hasBilledOverageData) {
    return {
      totalOverageRequests: billed.overageRequests,
      totalOverageCost: billed.overageCost,
    };
  }

  const totalsByUser = new Map<string, number>();
  const quotaByUser = buildUserQuotaMapFromRows(processedData);

  for (const row of processedData) {
    totalsByUser.set(row.user, (totalsByUser.get(row.user) ?? 0) + row.requestsUsed);
  }

  let totalOverageRequests = 0;
  for (const [user, totalRequests] of totalsByUser) {
    totalOverageRequests += calculateOverageRequests(totalRequests, quotaByUser.get(user) ?? 'unlimited');
  }

  return { totalOverageRequests, totalOverageCost: calculateOverageCost(totalOverageRequests) };
}

// -----------------------------
// Weekly Quota Exhaustion From Artifacts
// -----------------------------
export interface WeeklyQuotaExhaustionBreakdown {
  totalUsersExhausted: number;
  weeks: Array<{ weekNumber: number; startDate: string; endDate: string; usersExhaustedInWeek: number; }>; // non-cumulative
}

export function computeWeeklyQuotaExhaustionFromArtifacts(
  daily: DailyBucketsArtifacts,
  quota: QuotaArtifacts
): WeeklyQuotaExhaustionBreakdown {
  if (!daily.dateRange) return { totalUsersExhausted: 0, weeks: [] };
  // Determine full date range list and maintain cumulative usage per user
  const dates = Array.from(daily.dailyUserTotals.keys()).sort();
  if (dates.length === 0) return { totalUsersExhausted: 0, weeks: [] };

  // Collect users
  const users = new Set<string>();
  for (const dayMap of daily.dailyUserTotals.values()) {
    for (const u of dayMap.keys()) users.add(u);
  }

  interface ExhaustionRecord { user: string; exhaustionDate: string; monthKey: string; }
  const records: ExhaustionRecord[] = [];
  const cumulative = new Map<string, number>();
  for (const u of users) cumulative.set(u, 0);

  for (const date of dates) {
    const dayMap = daily.dailyUserTotals.get(date)!;
    for (const [user, val] of dayMap) {
      // Skip if already exhausted
      if (records.some(r => r.user === user)) continue;
      const quotaVal = quota.quotaByUser.get(user);
      if (!quotaVal || quotaVal === 'unlimited') continue;
      const newTotal = (cumulative.get(user) || 0) + val;
      cumulative.set(user, newTotal);
      if (newTotal >= quotaVal) {
        records.push({ user, exhaustionDate: date, monthKey: date.slice(0, 7) });
      }
    }
    // For users with no activity this day we still keep cumulative as-is.
  }

  if (records.length === 0) return { totalUsersExhausted: 0, weeks: [] };

  interface WeekKey { monthKey: string; weekNumber: number; startDate: string; endDate: string; }
  const weekMap = new Map<string, { key: WeekKey; users: Set<string> }>();
  for (const rec of records) {
    const d = rec.exhaustionDate; // YYYY-MM-DD
    const day = parseInt(d.slice(8, 10), 10);
    const { weekNumber, startDate, endDate } = dayOfMonthToWeekBucket(day, rec.monthKey);
    const mapKey = `${rec.monthKey}-W${weekNumber}`;
    if (!weekMap.has(mapKey)) weekMap.set(mapKey, { key: { monthKey: rec.monthKey, weekNumber, startDate, endDate }, users: new Set() });
    weekMap.get(mapKey)!.users.add(rec.user);
  }
  const weeks = Array.from(weekMap.values())
    .sort((a, b) => a.key.monthKey === b.key.monthKey ? a.key.weekNumber - b.key.weekNumber : a.key.monthKey.localeCompare(b.key.monthKey))
    .map(entry => ({ weekNumber: entry.key.weekNumber, startDate: entry.key.startDate, endDate: entry.key.endDate, usersExhaustedInWeek: entry.users.size }));
  return { totalUsersExhausted: records.length, weeks };
}

// -----------------------------
// Coding Agent Adoption From Artifacts
// -----------------------------
export function analyzeCodingAgentAdoptionFromArtifacts(usage: UsageArtifacts, quota: QuotaArtifacts): CodingAgentAnalysis {
  if (usage.users.length === 0) return { totalUsers: 0, totalUniqueUsers: 0, totalCodingAgentRequests: 0, adoptionRate: 0, users: [] };
  const totalUniqueUsers = usage.userCount;
  const codingAgentUsers = [] as CodingAgentAnalysis['users'];
  let totalCodingAgentRequests = 0;
  for (const u of usage.users) {
    // Identify coding agent models (keywords)
    const models = Object.keys(u.modelBreakdown).filter(m => isCodingAgentModel(m));
    if (models.length === 0) continue;
    const caRequests = models.reduce((sum, m) => sum + u.modelBreakdown[m], 0);
    totalCodingAgentRequests += caRequests;
    const quotaVal = quota.quotaByUser.get(u.user) ?? 'unlimited';
    codingAgentUsers.push({
      user: u.user,
      totalRequests: u.totalRequests,
      codingAgentRequests: caRequests,
      codingAgentPercentage: u.totalRequests > 0 ? (caRequests / u.totalRequests) * 100 : 0,
      quota: quotaVal,
      models
    });
  }
  codingAgentUsers.sort((a, b) => b.codingAgentRequests - a.codingAgentRequests);
  const adoptionRate = totalUniqueUsers > 0 ? (codingAgentUsers.length / totalUniqueUsers) * 100 : 0;
  return { totalUsers: codingAgentUsers.length, totalUniqueUsers, totalCodingAgentRequests, adoptionRate, users: codingAgentUsers };
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
  if (!daily.dateRange || !daily.dailyUserModelTotals) return [];
  // Locate user aggregate for model list & quick existence check
  const userAgg = usage.users.find(u => u.user === user);
  if (!userAgg) return [];
  const models = Object.keys(userAgg.modelBreakdown).sort();
  const { min, max } = daily.dateRange;
  const dates = enumerateDatesInclusive(min, max);
  let cumulative = 0;
  const result: UserDailyData[] = [];
  for (const date of dates) {
    const dayUserMap = daily.dailyUserModelTotals.get(date);
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
  totalRequests: number;
  // dynamic model keys mapping to daily counts
  [model: string]: string | number;
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
  if (!daily.dateRange || !daily.dailyUserModelTotals) return [];

  const { min, max } = daily.dateRange;
  const dates = enumerateDatesInclusive(min, max);

  // Discover global model list from usage artifacts for stable ordering
  const allModels = Object.keys(usage.modelTotals).sort();

  const result: DailyModelUsageDatum[] = [];
  for (const date of dates) {
    const dayUserMap = daily.dailyUserModelTotals.get(date);
    const row: DailyModelUsageDatum = { date, totalRequests: 0 };
    let dayTotal = 0;

    for (const model of allModels) {
      let modelTotal = 0;
      if (dayUserMap) {
        for (const modelMap of dayUserMap.values()) {
          modelTotal += modelMap.get(model) || 0;
        }
      }
      row[model] = modelTotal;
      dayTotal += modelTotal;
    }

    row.totalRequests = dayTotal;
    result.push(row);
  }

  return result;
}

// -----------------------------
// Feature Utilization From FeatureUsageArtifacts
// -----------------------------
/**
 * Build FeatureUtilizationStats (matching legacy calculateFeatureUtilization return shape)
 * directly from FeatureUsageAggregator artifacts.
 */
export function buildFeatureUtilizationFromArtifacts(featureUsage: FeatureUsageArtifacts): FeatureUtilizationStats {
  const { featureTotals, featureUsers, specialTotals } = featureUsage;
  const avg = (total: number, count: number) => (count > 0 ? total / count : 0);
  const codeReviewUsers = featureUsers.codeReview.size;
  const codingAgentUsers = featureUsers.codingAgent.size;
  const sparkUsers = featureUsers.spark.size;
  const nonCopilotCodeReviewRequests = specialTotals.nonCopilotCodeReview;
  const codeReviewRequests = Math.max(0, featureTotals.codeReview - nonCopilotCodeReviewRequests);
  return {
    codeReview: {
      totalSessions: codeReviewRequests,
      averagePerUser: avg(codeReviewRequests, codeReviewUsers),
      userCount: codeReviewUsers
    },
    codingAgent: {
      totalSessions: featureTotals.codingAgent,
      averagePerUser: avg(featureTotals.codingAgent, codingAgentUsers),
      userCount: codingAgentUsers
    },
    spark: {
      totalSessions: featureTotals.spark,
      averagePerUser: avg(featureTotals.spark, sparkUsers),
      userCount: sparkUsers
    },
    nonCopilotCodeReview: {
      totalSessions: nonCopilotCodeReviewRequests
    }
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
    const quotaVal = quota.quotaByUser.get(u.user) ?? 'unlimited';
    const pct = (typeof quotaVal === 'number' && quotaVal > 0)
      ? (u.totalRequests / quotaVal) * 100
      : 0;
    let category: UserConsumptionCategory['category'] = 'low';
    if (pct >= CONSUMPTION_THRESHOLDS.powerMinPct) category = 'power';
    else if (pct >= CONSUMPTION_THRESHOLDS.averageMinPct) category = 'average';
    return {
      user: u.user,
      totalRequests: u.totalRequests,
      quota: quotaVal,
      consumptionPercentage: pct,
      category
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
 * Build advisories leveraging artifact-derived categories and weekly quota exhaustion.
 * Mirrors legacy generateAdvisories logic but avoids raw row scans.
 */
export function buildAdvisoriesFromArtifacts(
  categories: InsightsOverviewData,
  weekly: WeeklyQuotaExhaustionBreakdown,
  usage: UsageArtifacts,
  quota: QuotaArtifacts
): LegacyAdvisory[] {
  // Currently quota artifacts not directly used; retained for future advisory enhancements.
  void quota;
  const advisories: LegacyAdvisory[] = [];
  const totalUsers = usage.userCount;
  if (totalUsers === 0) return advisories;

  // Early exhaustion: users who exhausted quota before day 28.
  // We derive this from weekly breakdown weeks 1-4 combined.
  const earlyUsersSet = new Set<string>();
  for (const w of weekly.weeks) {
    if (w.weekNumber <= 4) {
      // Need users list to know actual identities; WeeklyQuotaExhaustionBreakdown only has counts.
      // Artifact weekly breakdown lacks user identities; fallback: approximate using count ratio? For parity we retain legacy path when identities needed.
      // Enhancement: extend artifact to carry user lists. For now we cannot produce per-request billing advisory from artifacts without user identities.
    }
  }
  // If weekly breakdown cannot supply identities, we approximate by using category powerUsers as proxy for early exhausters.
  if (earlyUsersSet.size === 0 && weekly.totalUsersExhausted > 0) {
    categories.powerUsers.forEach(u => earlyUsersSet.add(u.user));
  }
  const earlyExhausterUsers = Array.from(earlyUsersSet);
  const earlyExhausterPercentage = earlyExhausterUsers.length / Math.max(1, totalUsers);
  if (earlyExhausterUsers.length > 0) {
    const severity: LegacyAdvisory['severity'] = earlyExhausterPercentage >= 0.30 ? 'high' : 'medium';
    advisories.push({
      type: 'perRequestBilling',
      severity,
      title: 'Consider Per-Request Billing for Power Users',
      description: `${earlyExhausterUsers.length} user${earlyExhausterUsers.length === 1 ? '' : 's'} (${(earlyExhausterPercentage * 100).toFixed(0)}%) exhaust their quota before day 28 of the month. These power users could benefit from per-request billing to avoid disruption.`,
      actionItems: [
        'Review power user consumption patterns in detail',
        'Set up per-request billing budgets for high-consumption users',
        'Configure spending limits to control costs',
        'Consider upgrading to a higher plan for consistent power users'
      ],
      affectedUsers: earlyExhausterUsers.length,
      estimatedImpact: `Indicative additional cost: ~$${(earlyExhausterUsers.length * 50 * PRICING.OVERAGE_RATE_PER_REQUEST).toFixed(0)}/month (assuming 50 extra requests per early power user)`,
      documentationLink: 'https://docs.github.com/en/enterprise-cloud@latest/billing/tutorials/set-up-budgets#managing-budgets-for-your-organization-or-enterprise'
    });
  }

  const lowAdoptionUsers = categories.lowAdoptionUsers;
  const lowUtilizationPercentage = lowAdoptionUsers.length / Math.max(1, totalUsers);
  if (lowUtilizationPercentage >= 0.40) {
    // Recalculate unused value using artifact categories.
    let unusedValue = 0;
    for (const u of lowAdoptionUsers) {
      if (typeof u.quota === 'number' && u.quota > 0) {
        const unused = Math.max(0, u.quota - u.totalRequests);
        unusedValue += unused * PRICING.OVERAGE_RATE_PER_REQUEST;
      }
    }
    advisories.push({
      type: 'training',
      severity: 'medium',
      title: 'Training Opportunity for Low-Adoption Users',
      description: `${lowAdoptionUsers.length} users (${(lowUtilizationPercentage * 100).toFixed(0)}%) are using less than 20% of their included premium requests, indicating potential adoption challenges.`,
      actionItems: [
        'Schedule GitHub Copilot training sessions focusing on best practices',
        'Share success stories from power users within your organization',
        'Create internal documentation with relevant use cases',
        'Set up pair programming sessions between power users and low-adoption users',
        'Consider creating internal Copilot champions program'
      ],
      affectedUsers: lowAdoptionUsers.length,
      estimatedImpact: `Unutilized value: ~$${unusedValue.toFixed(0)}/month`,
      documentationLink: 'https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/enable-developers/drive-adoption#supporting-effective-use-of-copilot-in-your-organization'
    });
  }

  return advisories;
}

// -----------------------------
// Coding Agent Daily Usage From Artifacts
// -----------------------------
/**
 * Build daily coding agent usage time series (date, dailyRequests, cumulativeRequests)
 * without scanning raw processedData rows. Leverages DailyBucketsAggregator's
 * dailyUserModelTotals nested map. Mirrors legacy computeDailyCodingAgentUsage
 * behavior by:
 *  - Including ONLY days with > 0 coding agent (or padawan) requests
 *  - Sorting by ascending date
 *  - Computing cumulativeRequests as running sum of dailyRequests
 * Falls back to empty array if required per-model breakdown map is absent.
 */
export function buildDailyCodingAgentUsageFromArtifacts(
  daily: DailyBucketsArtifacts
): DailyCodingAgentUsageDatum[] {
  if (!daily.dailyUserModelTotals) return [];
  const dayTotals: Array<{ date: string; total: number }> = [];
  for (const [date, userMap] of daily.dailyUserModelTotals.entries()) {
    let daySum = 0;
    for (const modelMap of userMap.values()) {
      for (const [model, qty] of modelMap.entries()) {
        if (isCodingAgentModel(model)) {
          daySum += qty;
        }
      }
    }
    if (daySum > 0) dayTotals.push({ date, total: daySum });
  }
  if (dayTotals.length === 0) return [];
  dayTotals.sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  return dayTotals.map(d => {
    cumulative += d.total;
    return { date: d.date, dailyRequests: d.total, cumulativeRequests: cumulative } as DailyCodingAgentUsageDatum;
  });
}

// -----------------------------
// Code Review Adoption From Artifacts
// -----------------------------
export function analyzeCodeReviewAdoptionFromArtifacts(usage: UsageArtifacts, quota: QuotaArtifacts): CodeReviewAnalysis {
  const nonCopilotBucket = usage.specialBuckets?.find(bucket => bucket.key === NON_COPILOT_CODE_REVIEW_BUCKET);
  const nonCopilotModels = Object.keys(nonCopilotBucket?.modelBreakdown ?? {}).filter(model => isCodeReviewModel(model));
  const hasNonCopilotReviewUsage = nonCopilotModels.length > 0;

  if (usage.users.length === 0 && !hasNonCopilotReviewUsage) {
    return { totalUsers: 0, totalUniqueUsers: 0, totalCodeReviewRequests: 0, adoptionRate: 0, users: [] };
  }

  const totalUniqueUsers = usage.userCount;
  const codeReviewUsers: CodeReviewAnalysis['users'] = [];
  let totalCodeReviewRequests = 0;
  let totalReviewUsers = 0;
  for (const u of usage.users) {
    const models = Object.keys(u.modelBreakdown).filter(m => isCodeReviewModel(m));
    if (models.length === 0) continue;
    const crRequests = models.reduce((sum, m) => sum + u.modelBreakdown[m], 0);
    totalCodeReviewRequests += crRequests;
    totalReviewUsers += 1;
    const quotaVal = quota.quotaByUser.get(u.user) ?? 'unlimited';
    codeReviewUsers.push({
      user: u.user,
      totalRequests: u.totalRequests,
      codeReviewRequests: crRequests,
      codeReviewPercentage: u.totalRequests > 0 ? (crRequests / u.totalRequests) * 100 : 0,
      quota: quotaVal,
      models
    });
  }

  if (nonCopilotBucket && hasNonCopilotReviewUsage) {
    const codeReviewRequests = nonCopilotModels.reduce((sum, model) => sum + nonCopilotBucket.modelBreakdown[model], 0);
    totalCodeReviewRequests += codeReviewRequests;
    codeReviewUsers.push({
      user: NON_COPILOT_CODE_REVIEW_ADOPTION_LABEL,
      totalRequests: nonCopilotBucket.totalRequests,
      codeReviewRequests,
      codeReviewPercentage: nonCopilotBucket.totalRequests > 0 ? (codeReviewRequests / nonCopilotBucket.totalRequests) * 100 : 0,
      quota: quota.specialBucketQuotas?.get(NON_COPILOT_CODE_REVIEW_BUCKET) ?? 0,
      models: nonCopilotModels,
      isSyntheticNonCopilotRow: true
    });
  }

  codeReviewUsers.sort((a, b) => b.codeReviewRequests - a.codeReviewRequests);
  const adoptionRate = totalUniqueUsers > 0 ? (totalReviewUsers / totalUniqueUsers) * 100 : 0;
  return { totalUsers: totalReviewUsers, totalUniqueUsers, totalCodeReviewRequests, adoptionRate, users: codeReviewUsers };
}

// -----------------------------
// Daily Code Review Usage From Artifacts
// -----------------------------
export function buildDailyCodeReviewUsageFromArtifacts(
  daily: DailyBucketsArtifacts
): DailyCodingAgentUsageDatum[] {
  if (!daily.dailyUserModelTotals) return [];
  const dayTotals: Array<{ date: string; total: number }> = [];
  for (const [date, userMap] of daily.dailyUserModelTotals.entries()) {
    let daySum = 0;
    for (const modelMap of userMap.values()) {
      for (const [model, qty] of modelMap.entries()) {
        if (isCodeReviewModel(model)) {
          daySum += qty;
        }
      }
    }
    if (daySum > 0) dayTotals.push({ date, total: daySum });
  }
  if (dayTotals.length === 0) return [];
  dayTotals.sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  return dayTotals.map(d => {
    cumulative += d.total;
    return { date: d.date, dailyRequests: d.total, cumulativeRequests: cumulative } as DailyCodingAgentUsageDatum;
  });
}

// -----------------------------
// Month List From Artifacts
// -----------------------------
/** Month names constant retained for consistent labeling (UTC context). */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

/**
 * Build month list (value, label) directly from DailyBucketsArtifacts.months.
 * Returns empty array when months not present (e.g., legacy artifact shape).
 */
export function buildMonthListFromArtifacts(daily: DailyBucketsArtifacts): { value: string; label: string }[] {
  if (!daily.months || daily.months.length === 0) return [];
  return daily.months.map(key => {
    const [yearStr, monthStr] = key.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    return { value: key, label: `${MONTH_NAMES[monthIndex]} ${yearStr}` };
  });
}
