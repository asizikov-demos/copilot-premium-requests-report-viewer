import { useMemo } from 'react';
import { ProcessedData, AnalysisResults, PowerUsersAnalysis, CodingAgentAnalysis } from '@/types/csv';
import { analyzePowerUsers, analyzeCodingAgentAdoption, filterBySelectedMonths, computeWeeklyQuotaExhaustion } from '@/utils/analytics';
import { PRICING } from '@/constants/pricing';
// New artifact-based analytics (incremental migration)
import {
  deriveAnalysisFromArtifacts,
  buildDailyCumulativeDataFromArtifacts,
  analyzePowerUsersFromArtifacts,
  analyzeCodingAgentAdoptionFromArtifacts,
  computeWeeklyQuotaExhaustionFromArtifacts,
  UsageArtifacts,
  QuotaArtifacts,
  DailyBucketsArtifacts
} from '@/utils/ingestion';

interface UseAnalyzedDataArgs {
  // Legacy pathway (to be removed after full migration):
  baseProcessed: ProcessedData[];
  // Filters
  selectedMonths: string[];
  minRequestsThreshold: number;
  // Optional artifact inputs for new ingestion pipeline. When all three are provided,
  // artifact-based analytics will be preferred.
  usageArtifacts?: UsageArtifacts;
  quotaArtifacts?: QuotaArtifacts;
  dailyBucketsArtifacts?: DailyBucketsArtifacts;
}

interface UseAnalyzedDataReturn {
  processedData: ProcessedData[]; // filtered
  analysis: AnalysisResults;
  userData: { user: string; totalRequests: number; modelBreakdown: Record<string, number>; }[];
  allModels: string[];
  dailyCumulativeData: { date: string; [user: string]: string | number; }[];
  powerUsersAnalysis: PowerUsersAnalysis;
  codingAgentAnalysis: CodingAgentAnalysis;
  weeklyExhaustion: ReturnType<typeof computeWeeklyQuotaExhaustion>;
}

/**
 * Encapsulates analytics transformation pipeline with current filter state.
 * Maintains strict UTC semantics by delegating to existing utilities that already
 * avoid local timezone conversions.
 */
export function useAnalyzedData({ baseProcessed, selectedMonths, minRequestsThreshold, usageArtifacts, quotaArtifacts, dailyBucketsArtifacts }: UseAnalyzedDataArgs): UseAnalyzedDataReturn {
  return useMemo(() => {
    const artifactsAvailable = !!(
      usageArtifacts && quotaArtifacts && dailyBucketsArtifacts &&
      usageArtifacts.users && usageArtifacts.modelTotals &&
      quotaArtifacts.quotaByUser && dailyBucketsArtifacts.dailyUserTotals
    );

    if (artifactsAvailable) {
      // NOTE: Month filtering currently still relies on legacy processed data (will migrate in later step).
      const filtered = filterBySelectedMonths(baseProcessed, selectedMonths);
      // Build hybrid: analysis & heavy computations from artifacts; retain processed subset for components needing row-level billing fields.
      const analysis = deriveAnalysisFromArtifacts(usageArtifacts!, quotaArtifacts!, dailyBucketsArtifacts!);
      const dailyCumulativeData = buildDailyCumulativeDataFromArtifacts(dailyBucketsArtifacts!);
      const powerUsersAnalysis = analyzePowerUsersFromArtifacts(usageArtifacts!, minRequestsThreshold);
      const codingAgentAnalysis = analyzeCodingAgentAdoptionFromArtifacts(usageArtifacts!, quotaArtifacts!);
      const weeklyExhaustion = computeWeeklyQuotaExhaustionFromArtifacts(dailyBucketsArtifacts!, quotaArtifacts!);
      // User summaries (model breakdown etc.) can be taken directly from usageArtifacts
      const userData = usageArtifacts!.users.map(u => ({ user: u.user, totalRequests: u.totalRequests, modelBreakdown: u.modelBreakdown })).sort((a, b) => b.totalRequests - a.totalRequests);
      const allModels = Object.keys(usageArtifacts!.modelTotals).sort();

      return {
        processedData: filtered, // still provided for components needing row-level details (billing fields)
        analysis,
        userData,
        allModels,
        dailyCumulativeData,
        powerUsersAnalysis,
        codingAgentAnalysis,
        weeklyExhaustion,
      };
    }

    // Legacy pathway
    const filtered = filterBySelectedMonths(baseProcessed, selectedMonths);
    const analysis: AnalysisResults = (() => {
      if (filtered.length === 0) return { timeFrame: { start: '', end: '' }, totalUniqueUsers: 0, usersExceedingQuota: 0, requestsByModel: [], quotaBreakdown: { unlimited: [], business: [], enterprise: [], mixed: false, suggestedPlan: null } };
      const sorted = [...filtered].sort((a,b)=> a.epoch - b.epoch);
      const timeFrame = { start: sorted[0].dateKey, end: sorted[sorted.length-1].dateKey };
      const uniqueUsers = new Set(filtered.map(r=>r.user));
      const userTotals = new Map<string, number>();
      const modelTotals = new Map<string, number>();
      const userQuota = new Map<string, number | 'unlimited'>();
      for (const r of filtered) {
        if (!userQuota.has(r.user)) userQuota.set(r.user, r.quotaValue);
        userTotals.set(r.user, (userTotals.get(r.user)||0)+r.requestsUsed);
        modelTotals.set(r.model,(modelTotals.get(r.model)||0)+r.requestsUsed);
      }
      let usersExceeding = 0;
      for (const [u,total] of userTotals) { const q = userQuota.get(u); if (q !== undefined && q !== 'unlimited' && total > q) usersExceeding++; }
      const requestsByModel = Array.from(modelTotals.entries()).map(([model,totalRequests])=>({ model, totalRequests })).sort((a,b)=> b.totalRequests - a.totalRequests);
      const unlimited: string[] = []; const business: string[] = []; const enterprise: string[] = [];
      for (const [u,q] of userQuota) { if (q === 'unlimited') unlimited.push(u); else if (q === PRICING.BUSINESS_QUOTA) business.push(u); else if (q === PRICING.ENTERPRISE_QUOTA) enterprise.push(u); }
      const types = [unlimited.length?'u':null,business.length?'b':null,enterprise.length?'e':null].filter(Boolean);
      const mixed = types.length > 1;
      let suggestedPlan: 'business' | 'enterprise' | null = null;
      if (!mixed && unlimited.length===0) { if (business.length && !enterprise.length) suggestedPlan='business'; else if (enterprise.length && !business.length) suggestedPlan='enterprise'; }
      return { timeFrame, totalUniqueUsers: uniqueUsers.size, usersExceedingQuota: usersExceeding, requestsByModel, quotaBreakdown: { unlimited, business, enterprise, mixed, suggestedPlan } };
    })();
    const userData = (() => {
      const map = new Map<string, { user: string; totalRequests: number; modelBreakdown: Record<string, number>; }>();
      for (const r of filtered) {
        let entry = map.get(r.user);
        if (!entry) { entry = { user: r.user, totalRequests: 0, modelBreakdown: {} }; map.set(r.user, entry); }
        entry.totalRequests += r.requestsUsed;
        entry.modelBreakdown[r.model] = (entry.modelBreakdown[r.model] || 0) + r.requestsUsed;
      }
      return Array.from(map.values()).sort((a,b)=> b.totalRequests - a.totalRequests);
    })();
    const allModels = Array.from(new Set(filtered.map(d => d.model))).sort();
    const dailyCumulativeData = (() => {
      if (filtered.length === 0) return [] as { date: string; [user: string]: string | number; }[];
      const sorted = [...filtered].sort((a,b)=> a.epoch - b.epoch);
      const users = Array.from(new Set(filtered.map(d=> d.user))).sort();
      const start = sorted[0].epoch; const end = sorted[sorted.length-1].epoch;
      const byDate = new Map<string, ProcessedData[]>();
      for (const r of sorted) { const arr = byDate.get(r.dateKey); if (arr) arr.push(r); else byDate.set(r.dateKey,[r]); }
      const totals = new Map<string, number>(); users.forEach(u=> totals.set(u,0));
      const result: { date: string; [user: string]: string | number; }[] = [];
      for (let cur = new Date(start); cur.getTime() <= end; cur.setUTCDate(cur.getUTCDate()+1)) {
        const dateStr = cur.toISOString().slice(0,10);
        const day = byDate.get(dateStr) || [];
        for (const r of day) totals.set(r.user,(totals.get(r.user)||0)+r.requestsUsed);
        const row: { date: string; [user: string]: string | number; } = { date: dateStr }; 
        for (const u of users) row[u] = totals.get(u) || 0; 
        result.push(row);
      }
      return result;
    })();
    const powerUsersAnalysis = analyzePowerUsers(filtered, minRequestsThreshold);
    const codingAgentAnalysis = analyzeCodingAgentAdoption(filtered);
    const weeklyExhaustion = computeWeeklyQuotaExhaustion(filtered);
    return {
      processedData: filtered,
      analysis,
      userData,
      allModels,
      dailyCumulativeData,
      powerUsersAnalysis,
      codingAgentAnalysis,
      weeklyExhaustion,
    };
  }, [baseProcessed, selectedMonths, minRequestsThreshold, usageArtifacts, quotaArtifacts, dailyBucketsArtifacts]);
}
