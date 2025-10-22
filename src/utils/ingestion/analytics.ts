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
import type { AnalysisResults } from '@/types/csv';
import type { QuotaArtifacts, UsageArtifacts, DailyBucketsArtifacts } from './types';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';
import { PowerUsersAnalysis, PowerUserScore, CodingAgentAnalysis, UserDailyData } from '@/types/csv';

/** Build time frame (start/end) from daily bucket date range. */
export function buildTimeFrame(daily: DailyBucketsArtifacts): { start: string; end: string } {
  if (!daily.dateRange) return { start: '', end: '' };
  return { start: daily.dateRange.min, end: daily.dateRange.max };
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

/** Build ordered list of dates (inclusive) between min and max (UTC). */
function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(startDate); d.getTime() <= endDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Construct daily cumulative per-user usage series from bucket artifacts.
 * This mirrors legacy generateDailyCumulativeData but avoids raw row scans.
 */
export function buildDailyCumulativeDataFromArtifacts(daily: DailyBucketsArtifacts): DailyCumulativeData[] {
  if (!daily.dateRange) return [];
  const { min, max } = daily.dateRange;
  const dates = enumerateDates(min, max);

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
    let weekNumber: number;
    if (day <= 7) weekNumber = 1; else if (day <= 14) weekNumber = 2; else if (day <= 21) weekNumber = 3; else if (day <= 28) weekNumber = 4; else weekNumber = 5;
    const [yearStr, monthStr] = rec.monthKey.split('-');
    const year = parseInt(yearStr, 10); const month = parseInt(monthStr, 10); // month 1-12
    const weekStartDay = weekNumber === 1 ? 1 : (weekNumber - 1) * 7 + 1;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const weekEndDay = weekNumber < 5 ? weekStartDay + 6 : lastDayOfMonth;
    const startDate = `${rec.monthKey}-${String(weekStartDay).padStart(2, '0')}`;
    const endDate = `${rec.monthKey}-${String(weekEndDay).padStart(2, '0')}`;
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
// Power Users From Artifacts
// -----------------------------
const POWER_DEFAULT_MIN_REQUESTS = 20;
const POWER_MAX_DISPLAY = 20;

// Reuse categorical logic (light/medium/heavy/special/vision) inline to avoid coupling to legacy file.
const POWER_LIGHT = ['gemini-2.0-flash', 'o3-mini', 'o-4-mini'];
const POWER_HEAVY = ['claude-opus-4', 'claude-3.7-sonnet-thought', 'o3', 'o4', 'gpt-4.5'];
const POWER_SPECIAL_KEYWORDS = ['code review', 'coding agent', 'padawan', 'spark'];
const MAX_SPECIAL_FEATURES_SCORE = 20;

function categorizeModelForPower(model: string): 'light' | 'medium' | 'heavy' | 'special' {
  const lower = model.toLowerCase();
  if (POWER_SPECIAL_KEYWORDS.some(k => lower.includes(k))) return 'special';
  if (POWER_HEAVY.some(k => lower.includes(k))) return 'heavy';
  if (POWER_LIGHT.some(k => lower.includes(k))) return 'light';
  return 'medium';
}

function isVision(model: string): boolean { return model.toLowerCase().includes('-vision'); }

function calculateSpecialFeaturesScoreArtifact(models: string[]): number {
  const set = new Set(models.map(m => m.toLowerCase()));
  let score = 0; const used = new Set<string>();
  const groups = [
    { type: 'code_review', keywords: ['code review'], score: 8 },
    { type: 'coding_agent', keywords: ['coding agent', 'padawan'], score: 8 },
    { type: 'spark', keywords: ['spark'], score: 4 }
  ];
  for (const g of groups) {
    if (g.keywords.some(k => set.has(k)) && !used.has(g.type)) { score += g.score; used.add(g.type); }
  }
  return Math.min(score, MAX_SPECIAL_FEATURES_SCORE);
}

function buildPowerUserScoreFromArtifact(user: { user: string; modelBreakdown: Record<string, number>; totalRequests: number; }): PowerUserScore {
  const models = Object.keys(user.modelBreakdown);
  const totalRequests = user.totalRequests;
  let light=0, medium=0, heavy=0, special=0, vision=0, uniqueModels=0;
  for (const m of models) {
    const qty = user.modelBreakdown[m];
    const cat = categorizeModelForPower(m);
    switch (cat) {
      case 'light': light += qty; uniqueModels++; break;
      case 'medium': medium += qty; uniqueModels++; break;
      case 'heavy': heavy += qty; uniqueModels++; break;
      case 'special': special += qty; break;
    }
    if (isVision(m)) vision += qty;
  }
  const diversityScore = Math.min(uniqueModels / 4, 1) * 30;
  const specialFeaturesScore = calculateSpecialFeaturesScoreArtifact(models);
  const visionScore = totalRequests > 0 ? Math.min((vision / totalRequests) / 0.2, 1) * 15 : 0;
  const heavyRatio = totalRequests > 0 ? heavy / totalRequests : 0;
  let balanceScore = 0;
  if (heavyRatio >= 0.2 && heavyRatio <= 0.4) balanceScore = 35; else if (heavyRatio < 0.1 || heavyRatio > 0.6) balanceScore = 0; else {
    if (heavyRatio < 0.2) balanceScore = 35 * (heavyRatio / 0.2); else balanceScore = 35 * (1 - (heavyRatio - 0.4) / 0.2);
  }
  const totalScore = diversityScore + specialFeaturesScore + visionScore + balanceScore;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    user: user.user,
    totalScore: round(totalScore),
    totalRequests,
    breakdown: {
      diversityScore: round(diversityScore),
      specialFeaturesScore: round(specialFeaturesScore),
      visionScore: round(visionScore),
      balanceScore: round(balanceScore)
    },
    modelUsage: {
      light: round(light),
      medium: round(medium),
      heavy: round(heavy),
      special: round(special),
      vision: round(vision),
      uniqueModels
    }
  };
}

export function analyzePowerUsersFromArtifacts(
  usage: UsageArtifacts,
  minRequestsThreshold: number = POWER_DEFAULT_MIN_REQUESTS
): PowerUsersAnalysis {
  const qualified = usage.users.filter(u => u.totalRequests >= minRequestsThreshold);
  const scores = qualified.map(u => buildPowerUserScoreFromArtifact(u));
  const top = scores.sort((a, b) => b.totalScore - a.totalScore).slice(0, POWER_MAX_DISPLAY);
  return { powerUsers: top, totalQualifiedUsers: qualified.length };
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
    const models = Object.keys(u.modelBreakdown).filter(m => {
      const lower = m.toLowerCase();
      return lower.includes('coding agent') || lower.includes('padawan');
    });
    if (models.length === 0) continue;
    const caRequests = models.reduce((sum, m) => sum + u.modelBreakdown[m], 0);
    totalCodingAgentRequests += caRequests;
    const quotaVal = quota.quotaByUser.get(u.user) ?? 'unlimited';
    codingAgentUsers.push({
      user: u.user,
      totalRequests: u.totalRequests,
      codingAgentRequests: caRequests,
      codingAgentPercentage: (caRequests / u.totalRequests) * 100,
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
/** Enumerate inclusive date list (YYYY-MM-DD) using already exported helper logic. */
function enumerateDatesInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Build per-user per-model daily stacked + cumulative dataset consumed by UserConsumptionModal
 * WITHOUT scanning raw rows. Requires DailyBucketsAggregator (with dailyUserModelTotals) + Usage artifacts.
 * Falls back to empty array if prerequisite artifact shape incomplete.
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
    const row: any = { date, totalCumulative: 0 };
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
